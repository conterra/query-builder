/*
 * Copyright (C) 2025 con terra GmbH (info@conterra.de)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *         http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import apprt_when from "apprt-core/when";
import async from "apprt-core/async";
import ct_lang from "ct/_lang";
import Filter from "ct/store/Filter";
import { MemoryStore } from "./MemoryStore";
import CachingStore from "./CachingStore";
import { toSQLWhere } from "store-api/rest/ComplexQueryToSQL";

const DELAY = 500;

export default class QueryController {

    #i18n = undefined;
    #query = undefined;
    #bundleContext = undefined;
    #serviceRegistration = undefined;
    #resultUiHandle = undefined;

    activate(componentContext) {
        this.#bundleContext = componentContext.getBundleContext();
        this.#i18n = this._i18n.get().ui;
    }

    deactivate() {
        this.cancelQuery();
        this.#query = undefined;
        this.#i18n = undefined;
    }

    query(store, complexQuery, options, tool, queryBuilderWidgetModel, layer) {
        this.searchReplacer(complexQuery);
        this.queryStore(store, complexQuery, options, tool, queryBuilderWidgetModel, layer);
        this._eventService.postEvent("dn_querybuilder/QUERY", { complexQuery: complexQuery });
    }

    cancelQuery() {
        const query = this.#query;
        if (query && query.cancel) {
            query.cancel();
        }
        this._dataModel?.setDatasource();
        this.#resultUiHandle?.cancel();
    }

    queryStore(store, complexQuery, options, tool, queryBuilderWidgetModel, layer) {
        this._setProcessing(tool, true, queryBuilderWidgetModel);
        const countFilter = new Filter(store, complexQuery, {});
        const idProperty = store.idProperty;
        let opts = null;
        if (idProperty) {
            opts = Object.assign({}, options);
            const fields = opts.fields = {};
            fields[idProperty] = true;
        }

        const definitionExpression = toSQLWhere(complexQuery);
        if (layer) {// reset previously applied or initial definitionExpression to allow filtering the entire layer
            layer.definitionExpression = definitionExpression;

            // save initial definitionExpression to enable reversion to initial state
            if (layer._initialDefinitionExpression === undefined) {
                layer._initialDefinitionExpression = layer.definitionExpression ? layer.definitionExpression : "1=1";
            }
        }

        let query = this.#query = countFilter.query({}, { count: 0 });
        let totalInQuery = true;
        if (!query.total) {
            query.total = query;
            totalInQuery = false;
        }
        return apprt_when(query.total, async (res) => {
            if (res && totalInQuery || res.total) {
                // smartfinder
                if (this._smartfinderComplexQueryHandler && store.coreName) {
                    this._smartfinderComplexQueryHandler.setComplexQuery(complexQuery);
                    this._setProcessing(tool, false, queryBuilderWidgetModel);
                    return;
                }

                // filter mode
                if (layer) {
                    this._setProcessing(tool, false, queryBuilderWidgetModel);
                    return;
                } else {
                    if (queryBuilderWidgetModel.enableTempStore) {
                        this._registerTempStore(store, complexQuery, queryBuilderWidgetModel);
                    }

                    // result-ui
                    const resultUiConfigured = this._resultViewerService;
                    if (resultUiConfigured) {
                        await this._openResultUi(tool, store, complexQuery, options, queryBuilderWidgetModel);
                        return;
                    }

                    // result-center
                    const resultCenterConfigured = this._dataModel != null;
                    if (resultCenterConfigured) {
                        query = this.#query = store.query(complexQuery, opts || options);
                        return apprt_when(query, (result) => {
                            this._setProcessing(tool, false, queryBuilderWidgetModel);
                            const idList = result ? result.map(item => item[idProperty]) : [];

                            let resultStore;
                            // Check if store has a get-method, i.e. it can retrieve single features by ID
                            if (store.get) {
                                resultStore = this._createResultReferenceStore(idList, store, 1000);
                            } else {
                                resultStore = this._createFullItemResultStore(idList, result, store);
                            }
                            resultStore.id = store.id;

                            this._dataModel.setDatasource(resultStore);
                            this._resultcenterToggleTool.set("active", true);
                        });
                    }
                }
                throw new Error("Could not process query result");
            } else {
                this._logService.warn({
                    message: this.#i18n.errors.noResultsError
                });
                this._setProcessing(tool, false, queryBuilderWidgetModel);
            }
        }, (e) => {
            this._setProcessing(tool, false, queryBuilderWidgetModel);
            this._logService.error({
                id: e.name,
                message: e.message
            });
        });
    }

    async _openResultUi(tool, store, complexQuery, queryOptions, queryBuilderWidgetModel) {
        const dataTableFactory = this._resultViewerService.dataTableFactory;
        const storeProperties = this._metadataAnalyzer.getStoreProperties(store.id);
        let dataTableTitle = storeProperties.title || store.id;
        if (tool.id !== "queryBuilderToggleTool") {
            dataTableTitle = tool.title;
        }
        const dataTable = await dataTableFactory.createDataTableFromStoreAndQuery(
            {
                dataTableTitle: dataTableTitle,
                dataSource: store,
                queryExpression: complexQuery,
                queryOptions: queryOptions
            }
        );
        const dataset = dataTable.dataset;
        const datasetStateHandle = dataset.watch("state", (event) => {
            const newState = event.value;
            if (newState === "initialized" || newState === "init-error") {
                this._setProcessing(tool, false, queryBuilderWidgetModel);
            }
        });
        const tableCollection = dataTableFactory.createDataTableCollection([dataTable]);
        const resultViewerServiceHandle = this._resultViewerService.open(tableCollection);

        const that = this;
        this.#resultUiHandle = {
            cancel() {
                that._setProcessing(tool, false, queryBuilderWidgetModel);
                datasetStateHandle.remove();
                resultViewerServiceHandle.remove();
            }
        };
    }

    _createFullItemResultStore(idList, result, masterStore) {
        return new MemoryStore({
            masterStore: masterStore,
            data: result,
            idProperty: masterStore.idProperty,
            // TODO: remove id list
            idList: idList
        });
    }

    _createResultReferenceStore(idList, masterStore, maxServerFeaturesLimit) {
        return new CachingStore({
            masterStore: masterStore,
            idList: idList,
            maxFeaturesLimit: maxServerFeaturesLimit
        });
    }

    searchReplacer(o) {
        const that = this;
        ct_lang.forEachOwnProp(o, function (value, name) {
            if (typeof (value) === "string") {
                o[name] = that._replacer.replace(value);
            }
            if (value !== null && typeof (value) === "object" && !value.extent) {
                that.searchReplacer(value);
            }
        });
    }

    async _registerTempStore(store, complexQuery, queryBuilderWidgetModel) {
        let tempStore;
        if (store.url) {
            tempStore = await this._agsStoreFactory.createStore({
                id: "querybuilder_temp",
                url: store.url
            });
        }
        if (store.layerId) {
            tempStore = await this._agsStoreFactory.createStore({
                id: "querybuilder_temp",
                layerId: store.layerId
            });
        }
        const filter = new Filter(tempStore, complexQuery);
        const storeTitle = queryBuilderWidgetModel.getSelectedStoreTitle(store.id);
        if (this.#serviceRegistration) {
            const registration = this.#serviceRegistration;
            // clear the reference
            this.#serviceRegistration = null;
            if (registration) {
                // call unregister
                registration.unregister();
            }
        }
        const title = storeTitle ? this.#i18n.tempStoreTitle + " (" + storeTitle + ")" : this.#i18n.tempStoreTitle;
        const serviceProperties = {
            id: "querybuilder_temp",
            title: title,
            useIn: ["querybuilder"]
        };
        const interfaces = ["ct.api.Store"];
        this.#serviceRegistration = this.#bundleContext.registerService(interfaces, filter, serviceProperties);
    }

    _setProcessing(tool, processing, queryBuilderWidgetModel) {
        if (queryBuilderWidgetModel) {
            async(() => {
                queryBuilderWidgetModel.set("processing", processing);
            }, DELAY);
        }
        if (tool) {
            tool.set("processing", processing);
        }
    }

}
