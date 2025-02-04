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
import { declare } from "apprt-core/Mutable";
import apprt_when from "apprt-core/when";
import ct_lang from "ct/_lang";
import Locale from "ct/Locale";
import Connect from "ct/_Connect";
import AsyncTask from "apprt-core/AsyncTask";
import Graphic from "esri/Graphic";
import Extent from "esri/geometry/Extent";
import { union, difference } from "esri/geometry/geometryEngine";
import Binding from "apprt-binding/Binding";
import ProjectParameters from "esri/rest/support/ProjectParameters";

const _replaceOpenedTablesBinding = Symbol("_spatialInputActionServiceBinding");
const _spatialInputActionServiceBinding = Symbol("_spatialInputActionServiceBinding");
const _spatialInputActionPromise = Symbol("_spatialInputActionPromise");
const _oldSpatialInputActionId = Symbol("_oldSpatialInputActionId");

export default declare({

    locale: "en",
    stores: [],
    storeData: [],
    sortFieldData: [],
    selectedStoreId: null,
    selectedSortFieldName: null,
    sortDescending: false,
    fieldQueries: [],
    loading: false,
    processing: false,
    activeTool: false,
    geometry: null,
    activeSpatialInputAction: null,
    activeSpatialInputActionDescription: null,
    negateSpatialInput: false,
    linkOperator: null,
    spatialRelation: null,

    // properties
    enableDistinctValues: true,
    enableInitialDistinctValues: true,
    defaultLinkOperator: "$or",
    defaultSpatialRelation: "everywhere",
    useCurrentMapExtent: false,
    visibleElements: {},
    availableSpatialInputActions: ["*"],
    spatialInputActions: [],
    allowMultipleSpatialInputs: true,
    defaultQueryOptions: {
        ignoreCase: false
    },
    hiddenFields: [
        "objectid",
        "OBJECTID",
        "shape"
    ],
    hiddenFieldTypes: [
        "oid",
        "guid",
        "global-id"
    ],
    hiddenSortFields: [
        "objectid",
        "OBJECTID",
        "shape"
    ],
    enableTempStore: false,
    replaceOpenedTables: false,
    metadataQuery: null,
    metadataDelay: 500,
    operators: {},
    defaultOperators: {
        default: {
            codedvalue: [
                { value: "$eq", text: "is" },
                { value: "!$eq", text: "is_not" },
                { value: "$gt", text: "is_greater_than" },
                { value: "$gte", text: "is_greater_or_equal" },
                { value: "$lt", text: "is_less_than" },
                { value: "$lte", text: "is_less_or_equal" },
                { value: "$exists", text: "exists" }
            ],
            boolean: [
                { value: "$eq", text: "is" },
                { value: "!$eq", text: "is_not" },
                { value: "$exists", text: "exists" }
            ],
            string: [
                { value: "$eq", text: "is" },
                { value: "!$eq", text: "is_not" },
                { value: "$eqw", text: "eqw" },
                { value: "$suggest", text: "suggest" },
                { value: "$exists", text: "exists" },
                { value: "$in", text: "in" }
            ],
            number: [
                { value: "$eq", text: "is" },
                { value: "!$eq", text: "is_not" },
                { value: "$gt", text: "is_greater_than" },
                { value: "$gte", text: "is_greater_or_equal" },
                { value: "$lt", text: "is_less_than" },
                { value: "$lte", text: "is_less_or_equal" },
                { value: "$exists", text: "exists" },
                { value: "$in", text: "in" }
            ],
            date: [
                { value: "$lte", text: "before" },
                { value: "$gte", text: "after" },
                { value: "$exists", text: "exists" }
            ],
            default: [
                { value: "$eq", text: "is" },
                { value: "!$eq", text: "is_not" },
                { value: "$exists", text: "exists" }
            ]
        }
    },

    activate() {
        this.locale = Locale.getCurrent().getLanguage();
        this.getStoreDataFromMetadata();
        this.linkOperator = this.defaultLinkOperator;
        this.spatialRelation = this.defaultSpatialRelation;
        this.fieldQueries = [];
        this.i18n = this._i18n.get();
        this.loadi18nText(this.defaultOperators);
        this.prepareOperators(this.operators);

        const connect = this.connect = new Connect();
        connect.connect(this._tool, "onActivate", () => {
            this.activeTool = true;
            this.getStoreDataFromMetadata();
            if (this.geometry) {
                this.addGraphicToView(this.geometry);
            }
        });
        connect.connect(this._tool, "onDeactivate", () => {
            this.activeTool = false;
            this.loading = false;
            this.processing = false;
            this.removeGraphicFromView();
            const oldSpatialInputAction = this[_spatialInputActionPromise];
            if (oldSpatialInputAction) {
                oldSpatialInputAction.cancel();
                this[_spatialInputActionPromise] = null;
            }
        });
        this.watch("geometry", (evt) => {
            this.removeGraphicFromView();
            if (evt.value) {
                this.addGraphicToView(evt.value);
            }
        });
        this.watch("negateSpatialInput", () => {
            this.resetSpatialInput();
        });
        this.watch("selectedStoreId", (evt) => {
            this.removeFieldQueries();
            this.addFieldQuery(evt.value);
            this.getFieldData(evt.value);
        });

        const spatialInputActionService = this._spatialInputActionService;
        this[_spatialInputActionServiceBinding] = Binding.for(this, spatialInputActionService)
            .syncToLeft("actions", "spatialInputActions",
                (actions) => actions.filter(this.getActionFilter()).map(({ id, title, description, iconClass }) => {
                    return {
                        id,
                        title,
                        description,
                        iconClass
                    };
                }))
            .enable()
            .syncToLeftNow();
        const resultApiConfig = this._resultApiConfig;
        this[_replaceOpenedTablesBinding] = Binding.for(this, resultApiConfig)
            .sync("replaceOpenedTables", "replace-opened-tables")
            .enable()
            .syncToLeftNow();
    },

    deactivate() {
        this.locale = null;
        this.connect.disconnect();
        this[_spatialInputActionServiceBinding].unbind();
        this[_spatialInputActionServiceBinding] = undefined;
        const oldSpatialInputAction = this[_spatialInputActionPromise];
        if (oldSpatialInputAction) {
            oldSpatialInputAction.cancel();
            this[_spatialInputActionPromise] = null;
        }
    },

    selectSpatialInputAction(id) {
        const spatialInputActionService = this._spatialInputActionService;
        const oldSpatialInputActionPromise = this[_spatialInputActionPromise];
        const oldSpatialInputActionId = this[_oldSpatialInputActionId];
        if (oldSpatialInputActionPromise) {
            oldSpatialInputActionPromise.cancel();
            this[_spatialInputActionPromise] = null;
        }
        if (oldSpatialInputActionId) {
            const oldSpatialInputAction = spatialInputActionService.getById(oldSpatialInputActionId);
            oldSpatialInputAction.disable?.();
            this[_oldSpatialInputActionId] = null;
        }
        if (!id) {
            this.activeSpatialInputAction = null;
            this.activeSpatialInputActionDescription = null;
            return;
        }
        this[_oldSpatialInputActionId] = id;
        const spatialInputAction = spatialInputActionService.getById(id);
        spatialInputAction.enable?.();
        const promise = this[_spatialInputActionPromise] = spatialInputAction.trigger({ queryBuilderSelection: true });
        promise.then((geometry) => {
            this.activeSpatialInputAction = null;
            this.activeSpatialInputActionDescription = null;
            if (this.negateSpatialInput) {
                if (this.allowMultipleSpatialInputs && this.geometry) {
                    this.geometry = difference(this.geometry, geometry);
                } else {
                    this.negateGeometry(geometry).then((g) => {
                        this.geometry = g;
                    });
                }
            } else {
                if (this.allowMultipleSpatialInputs && this.geometry) {
                    this.geometry = union([geometry, this.geometry]);
                } else {
                    this.geometry = geometry;
                }
            }
        });
        this.activeSpatialInputActionDescription = spatialInputAction.description;
    },

    negateGeometry(geometry) {
        const worldExtent = new Extent({
            xmin: -180,
            ymin: -90,
            xmax: 180,
            ymax: 90,
            spatialReference: 4326
        });
        const params = new ProjectParameters();
        params.geometries = [worldExtent];
        params.outSpatialReference = geometry.spatialReference;
        const geometryService = this._geometryService;
        const promise = geometryService.project(params);
        return promise.then((projectedGeometries) => difference(projectedGeometries[0], geometry));
    },

    resetSpatialInput() {
        this.geometry = null;
        this.activeSpatialInputAction = null;
        this.activeSpatialInputActionDescription = null;
    },

    getActionFilter() {
        const allowedMethods = this.availableSpatialInputActions;
        const all = !allowedMethods || allowedMethods[0] === "*";
        if (all) {
            return () => true;
        }
        const actionIdLookup = {};
        allowedMethods.forEach((id) => actionIdLookup[id] = true);
        return ({ id }) => actionIdLookup[id];
    },

    getStoreDataFromMetadata() {
        const stores = this.stores;
        const data = this._metadataAnalyzer.getStoreData(stores);
        this.storeData = data;
        if (!this.selectedStoreId) {
            this.selectedStoreId = data.length ? data[0].id : null;
        }
        this.getFieldData();
        return data;
    },

    getFieldData(selectedStoreId) {
        const sortFieldData = this._getSelectedSortFieldData(selectedStoreId || this.selectedStoreId);
        return apprt_when(sortFieldData, (data) => {
            if (data) {
                this.sortFieldData = data;
                this.selectedSortFieldName = data[0].id;
            }
        });
    },

    search(selectedStoreId, linkOperator, spatialRelation, fieldQueries, tool, options, editable, layer) {
        let filter = false;
        if (layer) {
            filter = true;
        }
        const selectedStore = this._metadataAnalyzer.getStore(selectedStoreId || this.selectedStoreId);
        const complexQuery = this.getComplexQuery(linkOperator || this.linkOperator,
            spatialRelation || this.spatialRelation, fieldQueries || this.fieldQueries, filter);
        let sortOptions = [];
        const opts = Object.assign({}, this.defaultQueryOptions || {}, options || {}, {
            suggestContains: true
        });
        if (this.visibleElements.sortSelect && !editable && !layer) {
            sortOptions = this.getSortOptions();
            opts.sort = sortOptions;
        }
        this._queryController.query(selectedStore, complexQuery, opts, tool || this._tool, this, layer);
    },

    cancelSearch() {
        this._queryController.cancelQuery();
    },

    addFieldQuery(selectedStoreId = this.selectedStoreId, fieldQueries = this.fieldQueries) {
        this.loading = true;
        const fieldData = this._getSelectedFieldData(selectedStoreId);
        return apprt_when(fieldData, (fields) => {
            if (!fields) {
                return;
            }
            const firstField = fields[0];
            if (!firstField) {
                this.loading = false;
                return;
            }
            const addedFieldQuery = {
                fields: fields,
                selectedFieldId: firstField.id,
                relationalOperator: "$eq",
                value: (firstField.codedValues[0] && firstField.codedValues[0].code) || ""
            };
            fieldQueries.push(addedFieldQuery);
            if (firstField.loading) {
                const watcher = firstField.watch("loading", (loading) => {
                    if (!loading.value) {
                        addedFieldQuery.value = (firstField.codedValues[0] && firstField.codedValues[0].code) || "";
                        watcher.remove();
                    }
                });
            }
            this.loading = false;
        }, this);
    },

    addFieldQueries(fields, editFields, selectedStoreId, fieldQueries) {
        fields.forEach((field, i) => {
            const editOptions = editFields && editFields[i];
            let fieldId;
            let relationalOperator;
            let value;
            ct_lang.forEachOwnProp(field, function (v1, n1) {
                fieldId = n1;
                ct_lang.forEachOwnProp(v1, function (v2, n2) {
                    if (n2 === "$not") {
                        relationalOperator = "!$eq";
                        value = v2["$eq"];
                    } else {
                        relationalOperator = n2;
                        value = v2;
                    }
                });
            });
            this.loading = true;
            const fieldData = this._getSelectedFieldData(selectedStoreId, true);
            apprt_when(fieldData, (fields) => {
                fieldQueries.push({
                    fields: fields,
                    selectedFieldId: fieldId,
                    relationalOperator: relationalOperator,
                    value: value || "",
                    disableField: !editOptions.field,
                    disableRelationalOperator: !editOptions.relationalOperator,
                    disableValue: !editOptions.value,
                    label: editOptions.label
                });
                this.loading = false;
            }, this);
        }, this);
    },

    getDistinctValues(value, fieldData, selectedStoreId) {
        const selectedStore = this._metadataAnalyzer.getStore(selectedStoreId || this.selectedStoreId);
        return apprt_when(
            this._metadataAnalyzer.getDistinctValues(value, fieldData, selectedStore,
                this.enableDistinctValues, this.enableInitialDistinctValues),
            (distinctValues) => {
                const lang = Locale.getCurrent().getLanguage();
                const type = fieldData.type;
                const dValues = fieldData.distinctValues;
                if (lang === "de" && type === "number" && dValues && dValues.length) {
                    fieldData.distinctValues = dValues.map(distinctValue => {
                        if (typeof distinctValue === "number" && !Number.isInteger(distinctValue)) {
                            return distinctValue.toString().replace(".", ",");
                        } else {
                            return distinctValue;
                        }
                    });
                }
                return distinctValues;
            });
    },

    _getSelectedFieldData(selectedStoreId, editable) {
        let hiddenFields = null;
        if (editable) {
            hiddenFields = [];
        }
        if (this.hiddenFields) {
            hiddenFields = this.hiddenFields;
        } else {
            hiddenFields = [];
        }
        const hiddenFieldTypes = this.hiddenFieldTypes;
        return this._getFilteredFieldData(selectedStoreId, hiddenFields, hiddenFieldTypes);
    },

    _getSelectedSortFieldData(selectedStoreId) {
        let hiddenSortFields = null;
        if (this.hiddenSortFields) {
            hiddenSortFields = this.hiddenSortFields;
        } else {
            hiddenSortFields = [];
        }
        const hiddenFieldTypes = this.hiddenFieldTypes;
        return this._getFilteredFieldData(selectedStoreId, hiddenSortFields, hiddenFieldTypes);
    },

    _getFilteredFieldData(selectedStoreId, hiddenFields, hiddenFieldTypes) {
        const store = this._metadataAnalyzer.getStore(selectedStoreId);
        if (!store) {
            return;
        }
        return apprt_when(this._metadataAnalyzer.getFields(store), (fieldData) =>
            fieldData.filter((field) => {
                const fieldNameAllowed = !hiddenFields.includes(field.id);
                const fieldTypeAllowed = !hiddenFieldTypes.includes(field.type);
                return fieldNameAllowed && fieldTypeAllowed;
            }));
    },

    checkDecimalSeparator(value) {
        return typeof value === 'string' && value.includes(",") ? value.replace(",", ".") : value;
    },

    getComplexQuery(linkOperator, spatialRelation, fieldQueries, filter) {
        const complexQuery = {};
        if (!filter) {
            if (this.geometry) {
                complexQuery.geometry = {
                    $intersects: this.geometry
                };
            } else if (spatialRelation === "current_extent") {
                const extent = this._mapWidgetModel.get("extent");
                complexQuery.geometry = {
                    $intersects: extent
                };
            }
        }
        complexQuery[linkOperator] = [];
        fieldQueries.forEach((fieldQuery) => {
            let not = false;
            const fieldId = fieldQuery.selectedFieldId;
            let relationalOperator = fieldQuery.relationalOperator;
            const firstChar = relationalOperator.substring(0, 1);
            if (firstChar === "!") {
                relationalOperator = relationalOperator.substring(1);
                not = true;
            }
            let value = fieldQuery.value;
            const field = fieldQuery.fields.find((field) => field.id === fieldId);
            if (field.type === "number") {
                if (typeof value === "boolean") {
                    // do nothing
                } else if (Array.isArray(value)) {
                    value = value.map(subvalue => {
                        subvalue = this.checkDecimalSeparator(subvalue);
                        return parseFloat(subvalue);
                    });
                } else {
                    value = this.checkDecimalSeparator(value);
                    value = parseFloat(value);
                }
            }
            if (field.type === "date" && typeof value === "string") {
                value = new Date(value);
            }
            if (value === "" || value === null || value === undefined || value.length === 0) {
                return;
            }
            const obj1 = {};
            const obj2 = {};
            obj1[relationalOperator] = value;
            if (not) {
                const notObj = {};
                notObj["$not"] = obj1;
                obj2[fieldId] = notObj;
            } else {
                obj2[fieldId] = obj1;
            }
            complexQuery[linkOperator].push(obj2);
        });
        return complexQuery;
    },

    getSortOptions() {
        const attribute = this.selectedSortFieldName;
        return [
            {
                "attribute": attribute,
                "descending": this.sortDescending
            }
        ];
    },

    removeFieldQuery(fieldQuery, fieldQueries = this.fieldQueries) {
        const index = fieldQueries.indexOf(fieldQuery);
        if (index > -1) {
            fieldQueries.splice(index, 1);
        }
    },

    removeFieldQueries(fieldQueries = this.fieldQueries) {
        while (fieldQueries.length > 0) {
            fieldQueries.pop();
        }
    },

    addGraphicToView(geometry) {
        this.removeGraphicFromView();
        const view = this._mapWidgetModel.get("view");
        const symbol = this.getGraphicSymbol(geometry.type);
        const graphic = this.graphic = new Graphic({
            geometry: geometry,
            symbol: symbol
        });
        view.graphics.add(graphic);
    },

    removeGraphicFromView() {
        if (this.graphic) {
            const view = this._mapWidgetModel.get("view");
            view.graphics.remove(this.graphic);
        }
    },

    getGraphicSymbol(type) {
        switch (type) {
            case "polygon":
            case "extent":
                return this.symbols.polygon;
            case "point":
                return this.symbols.point;
        }
    },

    getSelectedStoreTitle(selectedStoreId) {
        const storeData = this.storeData.find((data) => data.id === selectedStoreId);
        return storeData?.text || null;
    },

    addStore(store, properties) {
        properties = properties || {};
        const id = store?.id;
        if (!id) {
            console.debug("Store has no id and will be ignored!");
            return;
        }
        const newStores = this.stores.slice(0);
        const index = newStores.findIndex((s) => s.id === id);
        if (index >= 0) {
            console.warn(`Store with id '${id}' was already registered! It is replaced by the new store.`);
            newStores.splice(index, 1);
        }
        newStores.push({
            id: id,
            title: store.title || properties.title || id,
            description: store.description || properties.description || ""
        });
        this.stores = newStores;
        return this.getStoreDataFromMetadata();
    },

    removeStore(store) {
        const id = store?.id;
        if (!id) {
            return;
        }
        const stores = this.stores;
        const index = stores.findIndex((s) => s.id === id);
        if (index < 0) {
            return;
        }
        const newStores = stores.slice(0);
        newStores.splice(index, 1);
        this.stores = newStores;
        if (!this._selectedStoreStillAvailable(newStores)) {
            this.selectedStoreId = null;
        }
        this._deferredMetadata();
    },

    _deferredMetadata() {
        let metadataQuery;
        if (this.metadataQuery) {
            metadataQuery = this.metadataQuery;
        } else {
            metadataQuery =
                AsyncTask(this.getStoreDataFromMetadata.bind(this)).delay.bind(this, this.metadataDelay);
        }
        metadataQuery();
    },

    _selectedStoreStillAvailable(stores) {
        return stores.find((store) => store.id === this.selectedStoreId);
    },

    loadi18nText(operators) {
        if (typeof operators === 'object' && operators !== null) {
            if (Array.isArray(operators)) {
                operators.forEach(item => this.loadi18nText(item));
            } else {
                Object.keys(operators).forEach(key => {
                    if (typeof operators[key] === 'object' && operators[key] !== null) {
                        this.loadi18nText(operators[key]);
                    } else if (key === "text") {
                        const replacement = this.i18n.ui.relationalOperators[operators[key]];
                        if (replacement) {
                            operators[key] = replacement;
                        }
                    }
                });
            }
        }
        return;
    },

    prepareOperators(operators) {
        const completeOperators = { ...this.defaultOperators };
        Object.keys(operators).forEach(configuration => {
            completeOperators[configuration] = { ...this.defaultOperators.default };
            Object.keys(operators[configuration]).forEach(type => {
                completeOperators[configuration][type] = operators[configuration][type];
            });
        });
        this.operators = completeOperators;
        return;
    }
});
