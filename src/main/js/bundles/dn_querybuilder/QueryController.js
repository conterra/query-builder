/*
 * Copyright (C) 2019 con terra GmbH (info@conterra.de)
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
import MemorySelectionStore from "./MemorySelectionStore";

export default class QueryController {
    activate(componentContext) {
        this.i18n = this._i18n.get().ui;
    }

    query(store, complexQuery, options, tool, queryBuilderWidgetModel) {
        this.searchReplacer(complexQuery);
        let queryBuilderProperties = this._queryBuilderProperties;
        if (queryBuilderProperties.useMemorySelectionStore) {
            this.memorySelectionQuery(store, complexQuery, options, tool, queryBuilderWidgetModel);
        } else {
            this.defaultQuery(store, complexQuery, options, tool, queryBuilderWidgetModel);
        }
        this._eventService.postEvent("dn_querybuilder/QUERY");
    }

    memorySelectionQuery(store, complexQuery, options, tool, queryBuilderWidgetModel) {
        this._setProcessing(tool, true, queryBuilderWidgetModel);
        options.fields = {geometry: 1};
        apprt_when(store.query(complexQuery, options), (result) => {
            if (result.total) {
                let mapWidgetModel = this._mapWidgetModel;
                let spatialReference = mapWidgetModel.get("spatialReference");
                let wkid = spatialReference.latestWkid || spatialReference.wkid;
                let geometries = result.map((item) => item.geometry);

                if (geometries[0]) {
                    apprt_when(this._coordinateTransformer.transform(geometries, wkid), (transformedGeometries) => {
                        transformedGeometries.forEach((tg, index) => {
                            result[index].geometry = tg;
                        });
                    }, this);
                }

                let memorySelectionStore = new MemorySelectionStore({
                    id: "querybuilder_" + store.id,
                    idProperty: store.idProperty,
                    masterStore: store,
                    data: result
                });

                this._dataModel.setDatasource(memorySelectionStore);
                this._setProcessing(tool, false, queryBuilderWidgetModel);

            } else {
                this._logService.warn({
                    id: 0,
                    message: this.i18n.errors.noResultsError
                });
                this._setProcessing(tool, false, queryBuilderWidgetModel);
            }
        }, (e) => {
            this._logService.error({
                id: e.code,
                message: e
            });
            this._setProcessing(tool, false, queryBuilderWidgetModel);
        });
    }

    defaultQuery(store, complexQuery, options, tool, queryBuilderWidgetModel) {
        this._setProcessing(tool, true, queryBuilderWidgetModel);
        let filter = new Filter(store, complexQuery, options);
        let countFilter = new Filter(store, complexQuery, {});
        apprt_when(countFilter.query({}, {count: 0}).total, (total) => {
            if (total) {
                this._dataModel.setDatasource(filter);
                this._setProcessing(tool, false, queryBuilderWidgetModel);
            } else {
                this._logService.warn({
                    id: 0,
                    message: this.i18n.errors.noResultsError
                });
                this._setProcessing(tool, false, queryBuilderWidgetModel);
            }
        }, (e) => {
            this._setProcessing(tool, false, queryBuilderWidgetModel);
            this._logService.error({
                id: e.code,
                message: e
            });
        });
    }

    searchReplacer(o) {
        let that = this;
        ct_lang.forEachOwnProp(o, function (value, name) {
            if (typeof (value) === "string") {
                o[name] = that._replacer.replace(value);
            }
            if (value !== null && typeof (value) === "object" && !value.extent) {
                that.searchReplacer(value);
            }
        });
    }

    _setProcessing(tool, processing, queryBuilderWidgetModel) {
        if (queryBuilderWidgetModel) {
            async(() => {
                queryBuilderWidgetModel.set("processing", processing)
            }, 100);
        }
        if (tool) {
            tool.set("processing", processing);
        }
    }
}
