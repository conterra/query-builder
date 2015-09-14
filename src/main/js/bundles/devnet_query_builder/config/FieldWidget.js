/*
 * Copyright (C) 2015 con terra GmbH (info@conterra.de)
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
define([
    "dojo/_base/lang",
    "dojo/_base/declare",
    "dojo/_base/Deferred",
    "dojo/parser",
    "dojo/_base/array",
    "ct/_Connect",
    "ct/_when",
    "esri/tasks/query",
    "esri/tasks/QueryTask",
    "dijit/_WidgetBase",
    "dijit/_TemplatedMixin",
    "dijit/_WidgetsInTemplateMixin",
    "dojo/text!./templates/FieldWidget.html",
    "dijit/form/TextBox",
    "dijit/form/ValidationTextBox",
    "dijit/form/ComboBox",
    "dijit/form/FilteringSelect",
    "dijit/form/Button",
    "dijit/form/DateTextBox",
    "dojo/store/Memory",
    "dojo/dom-construct",
    "dijit/layout/ContentPane",
    "dijit/layout/BorderContainer"
], function (d_lang,
        declare,
        Deferred,
        parser,
        d_array,
        _Connect,
        ct_when,
        Query,
        QueryTask,
        _WidgetBase,
        _TemplatedMixin,
        _WidgetsInTemplateMixin,
        template,
        TextBox,
        ValidationTextBox,
        ComboBox,
        FilteringSelect,
        Button,
        DateTextBox,
        Memory,
        domConstruct,
        ContentPane,
        BorderContainer) {

    return declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, _Connect], {
        templateString: template,
        postCreate: function () {
            this.inherited(arguments);
            ct_when(this.store.getMetadata(), function (metadata) {
                this._supportsDistincts = metadata.advancedQueryCapabilities && metadata.advancedQueryCapabilities.supportsDistinct;
                if (this.type === "user") {
                    this._fieldSelectWidth = "width: 140px;";
                    this._valueSelectWidth = "width: 120px;";
                    this._compareSelectWidth = "width: 120px;";
                } else {
                    this._fieldSelectWidth = "width: 180px;";
                    this._valueSelectWidth = "width: 200px;";
                    this._compareSelectWidth = "width: 120px;";
                }
                this.maxComboBoxHeight = 160;
                var fieldData = this.storeData;
                var fieldStore = this._fieldStore = new Memory({
                    data: fieldData
                });
                var fieldSelect = this._fieldSelect = new FilteringSelect({
                    name: "fields",
                    value: fieldData[0].id,
                    store: fieldStore,
                    searchAttr: "title",
                    style: this._fieldSelectWidth,
                    maxHeight: this.maxComboBoxHeight
                }, this._fieldNode);
                fieldSelect.startup();
                var removeButton = new Button({
                    label: "-",
                    onClick: function () {
                        removeButton.domNode.parentNode.remove();
                        this._remove();
                    }.bind(this)
                });
                domConstruct.place(removeButton.domNode, this._buttonNode, "replace");
                removeButton.startup();
                if (this.fieldId) {
                    this._fieldSelect.set("value", this.fieldId);
                }
                ct_when(this._createCompareSelect(), function () {
                    this.connect(fieldSelect, "onChange", this._changeCompareSelect);
                }, this);
            }, this);
        },
        resize: function (dim) {
            if (dim && dim.h > 0) {
                this._containerNode.resize({
                    w: dim.w,
                    h: dim.h - this.getHeadingHeight()
                });
            }
        },
        _remove: function () {
        },
        _createCompareSelect: function () {
            var def = new Deferred();
            var fieldSelect = this._fieldSelect;
            var selectedField = fieldSelect.get("value");
            var type = this._fieldStore.get(selectedField).type;
            var codedValues = this._fieldStore.get(selectedField).codedValues;
            var compareSelect;
            if (codedValues.length > 0) {
                var compareStore = this._compareStore = this._createCodedValueStore();
                compareSelect = this._compareSelect = new FilteringSelect({
                    name: "compares",
                    value: this.compareId || "is",
                    store: compareStore,
                    searchAttr: "name",
                    style: this._compareSelectWidth,
                    maxHeight: this.maxComboBoxHeight
                }, this._compareNode);
                compareSelect.startup();
                var codedValueData = [];
                d_array.forEach(codedValues, function (codedValue) {
                    codedValueData.push({name: codedValue.name, id: codedValue.code});
                });
                var codedValueStore = new Memory({
                    data: codedValueData
                });
                var valueSelect = this._valueField = new FilteringSelect({
                    name: "value",
                    value: this.value || codedValueData[0].id,
                    store: codedValueStore,
                    searchAttr: "name",
                    style: this._valueSelectWidth,
                    maxHeight: this.maxComboBoxHeight
                });
                domConstruct.place(valueSelect.domNode, this._valueNode);
                valueSelect.startup();
                def.resolve();
            } else {
                if (type === "string") {
                    var compareStore = this._compareStore = this._createStringStore();
                    compareSelect = this._compareSelect = new FilteringSelect({
                        name: "compares",
                        value: this.compareId || "is",
                        store: compareStore,
                        searchAttr: "name",
                        style: this._compareSelectWidth
                    }, this._compareNode);
                } else if (type === "number" || type === "integer" || type === "double") {
                    var compareStore = this._compareStore = this._createNumberStore();
                    compareSelect = this._compareSelect = new FilteringSelect({
                        name: "compares",
                        value: this.compareId || "is_number",
                        store: compareStore,
                        searchAttr: "name",
                        style: this._compareSelectWidth
                    }, this._compareNode);
                } else if (type === "date") {
                    var compareStore = this._compareStore = this._createDateStore();
                    compareSelect = this._compareSelect = new FilteringSelect({
                        name: "compares",
                        value: this.compareId || "before",
                        store: compareStore,
                        searchAttr: "name",
                        style: this._compareSelectWidth
                    }, this._compareNode);
                }
                compareSelect.startup();
                if (this._supportsDistincts === true) {
                    ct_when(this._getDistinctValues(selectedField), function (result) {
                        result.sort();
                        var distinctValueData = [];
                        d_array.forEach(result, function (distinctValue) {
                            distinctValueData.push({id: distinctValue});
                        });
                        var distinctValueStore = new Memory({
                            data: distinctValueData
                        });
                        var valueComboBox = this._valueField = new ComboBox({
                            name: "value",
                            value: this.value || distinctValueData[0].id,
                            store: distinctValueStore,
                            searchAttr: "id",
                            style: this._valueSelectWidth,
                            maxHeight: this.maxComboBoxHeight
                        });
                        domConstruct.place(valueComboBox.domNode, this._valueNode);
                        valueComboBox.startup();
                        def.resolve();
                    }, this);
                } else {
                    if (type === "date") {
                        var valueSelect = this._valueField = new DateTextBox({
                            name: "value",
                            value: this.value || new Date(),
                            style: this._valueSelectWidth,
                            maxHeight: this.maxComboBoxHeight
                        });
                    } else {
                        var valueSelect = this._valueField = new TextBox({
                            name: "value",
                            value: this.value || "",
                            placeHolder: this.i18n.typeInValue,
                            style: this._valueSelectWidth,
                            maxHeight: this.maxComboBoxHeight
                        });
                    }
                    domConstruct.place(valueSelect.domNode, this._valueNode);
                    valueSelect.startup();
                    def.resolve();
                }
            }
            return def;
        },
        _changeCompareSelect: function (type, value) {
            var fieldSelect = this._fieldSelect;
            var selectedField = fieldSelect.get("value");
            var type = this._fieldStore.get(selectedField).type;
            var codedValues = this._fieldStore.get(selectedField).codedValues;
            while (this._valueNode.firstChild) {
                this._valueNode.removeChild(this._valueNode.firstChild);
            }
            var compareSelect = this._compareSelect;
            if (codedValues.length > 0) {
                var compareStore = this._compareStore = this._createCodedValueStore();
                compareSelect.set("store", compareStore);
                compareSelect.set("value", this.compareId || "is");
                var codedValueData = [];
                d_array.forEach(codedValues, function (codedValue) {
                    codedValueData.push({name: codedValue.name, id: codedValue.code});
                });
                var codedValueStore = new Memory({
                    data: codedValueData
                });
                var value;
                if (this.fieldId === this._getSelectedField().id) {
                    value = this.value;
                } else {
                    value = codedValueData[0] && codedValueData[0].id;
                }
                var valueSelect = this._valueField = new FilteringSelect({
                    name: "value",
                    value: value,
                    store: codedValueStore,
                    searchAttr: "name",
                    style: this._valueSelectWidth,
                    maxHeight: this.maxComboBoxHeight
                });
                domConstruct.place(valueSelect.domNode, this._valueNode);
                valueSelect.startup();
            } else {
                if (type === "string") {
                    var compareStore = this._compareStore = this._createStringStore();
                    compareSelect.set("store", compareStore);
                    compareSelect.set("value", this.compareId || "is");
                } else if (type === "number" || type === "integer" || type === "double") {
                    var compareStore = this._compareStore = this._createNumberStore();
                    compareSelect.set("store", compareStore);
                    compareSelect.set("value", this.compareId || "is_number");
                } else if (type === "date") {
                    var compareStore = this._compareStore = this._createDateStore();
                    compareSelect.set("store", compareStore);
                    compareSelect.set("value", this.compareId || "before");
                }
                if (this._supportsDistincts === true) {
                    ct_when(this._getDistinctValues(selectedField), function (result) {
                        result.sort();
                        var distinctValueData = [];
                        d_array.forEach(result, function (distinctValue) {
                            distinctValueData.push({id: distinctValue});
                        });
                        var distinctValueStore = new Memory({
                            data: distinctValueData
                        });
                        var value;
                        if (this.fieldId === this._getSelectedField().id) {
                            value = this.value;
                        } else {
                            value = distinctValueData[0] && distinctValueData[0].id;
                        }
                        var valueComboBox = this._valueField = new ComboBox({
                            name: "value",
                            value: value,
                            store: distinctValueStore,
                            searchAttr: "id",
                            style: this._valueSelectWidth,
                            maxHeight: this.maxComboBoxHeight
                        });
                        domConstruct.place(valueComboBox.domNode, this._valueNode);
                        valueComboBox.startup();
                    }, this);
                } else {
                    if (type === "date") {
                        var value;
                        if (this.fieldId === this._getSelectedField().id) {
                            value = this.value;
                        } else {
                            value = new Date();
                        }
                        var valueSelect = this._valueField = new DateTextBox({
                            name: "value",
                            value: value,
                            style: this._valueSelectWidth,
                            maxHeight: this.maxComboBoxHeight
                        });
                    } else {
                        if (this.fieldId === this._getSelectedField().id) {
                            value = this.value;
                        } else {
                            value = "";
                        }
                        var valueSelect = this._valueField = new TextBox({
                            name: "value",
                            value: value,
                            placeHolder: this.i18n.typeInValue,
                            style: this._valueSelectWidth,
                            maxHeight: this.maxComboBoxHeight
                        });
                    }
                    domConstruct.place(valueSelect.domNode, this._valueNode);
                    valueSelect.startup();
                }
            }
        },
        _getDistinctValues: function (selectedField) {
            var query = new Query();
            var queryTask = new QueryTask(this.store.target);
            query.where = "1=1";
            query.returnGeometry = false;
            query.outFields = [selectedField];
            query.returnDistinctValues = true;
            return ct_when(queryTask.execute(query), function (result) {
                var distinctValues = [];
                var features = result.features;
                d_array.forEach(features, function (feature) {
                    var value = feature.attributes[selectedField];
                    if (value !== null) {
                        distinctValues.push(value);
                    }
                }, this);
                return distinctValues;
            }, this);
        },
        _createCodedValueStore: function () {
            var i18n = this.i18n;
            var store = new Memory({
                data: [
                    {id: "is", name: i18n.is},
                    {id: "is_not", name: i18n.is_not}
                ]
            });
            return store;
        },
        _createStringStore: function () {
            var i18n = this.i18n;
            var store = new Memory({
                data: [
                    {id: "is", name: i18n.is},
                    {id: "is_not", name: i18n.is_not},
                    {id: "contains", name: i18n.contains},
                    {id: "contains_not", name: i18n.contains_not},
                    {id: "starts_with", name: i18n.starts_with},
                    {id: "ends_with", name: i18n.ends_with}
                ]
            });
            return store;
        },
        _createNumberStore: function () {
            var i18n = this.i18n;
            var store = new Memory({
                data: [
                    {id: "is_number", name: i18n.is},
                    {id: "is_not_number", name: i18n.is_not},
                    {id: "is_greater_number", name: i18n.is_greater_than},
                    {id: "is_greater_or_equal_number", name: i18n.is_greater_or_equal},
                    {id: "is_less_number", name: i18n.is_less_than},
                    {id: "is_less_or_equal_number", name: i18n.is_less_or_equal}
                ]
            });
            return store;
        },
        _createDateStore: function () {
            var i18n = this.i18n;
            var store = new Memory({
                data: [
                    {id: "before", name: i18n.before},
                    {id: "after", name: i18n.after}
                ]
            });
            return store;
        },
        _removeFields: function (node) {
            while (node.firstChild) {
                node.removeChild(node.firstChild);
            }
        },
        _getSelectedField: function () {
            var id = this._fieldSelect.value;
            var store = this._fieldStore;
            var result = store.get(id);
            return result;
        },
        _getSelectedCompare: function () {
            var id = this._compareSelect.value;
            var store = this._compareStore;
            var result = store.get(id);
            return result;
        },
        _getValue: function () {
            var result = this._valueField.value;
            return result;
        }
    });
});