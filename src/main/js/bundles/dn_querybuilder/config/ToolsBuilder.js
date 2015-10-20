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
    "dojo/_base/array",
    "ct/_lang",
    "ct/_Connect",
    "ct/array",
    "ct/Exception",
    "ct/_string",
    "./ToolsBuilderWidget",
    "./ToolsBuilderWizard",
    "ct/store/ComplexMemory",
    "ct/_when",
    "ct/Hash",
    "ct/async",
    "dijit/registry"
], function (d_lang, declare, d_array, ct_lang, _Connect, ct_array, Exception, ct_string, ToolsBuilderWidget, ToolsBuilderWizard, ComplexMemoryStore, ct_when, Hash, ct_async, d_registry) {
    return declare([_Connect],
            {
                createInstance: function () {
                    var configStore = this._getConfigStore();
                    var properties = this._properties || {};
                    var i18nGRID = this._i18n.get().widget.grid;
                    var opts = d_lang.mixin({
                        configStore: configStore,
                        toolbar: this._toolbar,
                        i18n: i18nGRID
                    }, properties.widgetProperties);
                    var widget = this._widget = new ToolsBuilderWidget(opts);
                    this.connect(widget, "onRemoveQueryTool", "_onRemoveQueryTool");
                    this.connect(widget, "onCreateQueryTool", "_onCreateQueryTool");
                    this.connect(widget, "onEditQueryTool", "_onEditQueryTool");
                    this.connect(widget, "onCopyQueryTool", "_onCopyQueryTool");
                    return widget;
                },
                destroyInstance: function (instance) {
                    this.disconnect();
                    this._configStore = null;
                    var window = this._window;
                    if (window) {
                        window.close();
                        this._window = null;
                    }
                    this._widget = null;
                    instance.destroyRecursive();
                },
                _getConfigStore: function () {
                    if (!this._configStore) {
                        this._configStore = new ComplexMemoryStore({
                            data: [],
                            idProperty: "pid",
                            metadata: {
                                //Attribute der Tabellen im ToolsBuilderWidget
                                displayField: "name",
                                fields: [
                                    /*{
                                     "title": "ID",
                                     "name": "id",
                                     "type": "string",
                                     "identifier": true
                                     },*/
                                    {
                                        "title": "Title",
                                        "name": "title",
                                        "type": "string"
                                    },
                                    {
                                        "title": "IconClass",
                                        "name": "iconClass",
                                        "type": "string"
                                    },
                                    {
                                        "title": "Store ID",
                                        "name": "storeId",
                                        "type": "string"
                                    }/*,
                                     {
                                     "title": "Custom Query",
                                     "name": "customquery",
                                     "type": "string",
                                     "subtype": "prettyJson"
                                     }*/
                                ]
                            }
                        });
                        this._initConfigStore();
                    }
                    return this._configStore;
                },
                _initConfigStore: function () {
                    var configStore = this._configStore;
                    var configAdminService = this._configAdminService;
                    var properties = this._properties.widgetProperties;
                    var data = configAdminService.getFactoryConfigurations(properties.pid, properties.bid);
                    data = d_array.map(data, function (config) {
                        var props = config.get("properties");
                        props.pid = config.get("pid");
                        return props;
                    }, this);
                    configStore.setData(data);
                },
                _applyConfig: function (properties) {
                    properties = d_lang.clone(properties);
                    var props = this._properties.widgetProperties;
                    var config = this._configAdminService.createFactoryConfiguration(props.pid, props.bid);
                    delete properties.pid;
                    config.update(properties);
                },
                _updateConfig: function (properties) {
                    properties = d_lang.clone(properties);
                    var config = this._getConfiguration(properties.pid);
                    delete properties.pid;
                    config.update(properties);
                },
                _createWizard: function (config) {
                    // time & default icon
                    var date = new Date();
                    if (config.id === undefined) {
                        config.id = "fc_" + date.getTime();
                        config.title = "";
                        config.iconClass = "icon-custom-info";
                        config.customquery = {};
                        config.options = {};
                    }
                    // search stores
                    var stores = this._agsstores;
                    var storeData = this._getStoreData(stores);
                    var wizardI18n = this._i18n.get().widget.wizard;
                    return ct_when(storeData, function (storeData) {
                        var wizard = new ToolsBuilderWizard({storeData: storeData, globalProperties: this._properties, properties: config, i18n: wizardI18n, windowManager: this._windowManager, appCtx: this._appCtx, agsstores: this._agsstores, mapState: this._mapState, mapModel: this._mapModel, coordinateTransformer: this._coordinateTransformer, replacer: this._replacer});
                        return wizard;
                    }, this);

                },
                _openWizardWindow: function (wizard, edit) {
                    var properties = wizard.get("properties");
                    var windowManager = this._windowManager;
                    var i18n = this._i18n.get().widget.wizard;
                    var title;
                    if (edit === true) {
                        title = i18n.windowtitleEdit;
                    } else {
                        title = i18n.windowtitleAdd;
                    }
                    var window = windowManager.createModalWindow({
                        title: title,
                        marginBox: {
                            w: 840,
                            h: 520
                        },
                        content: wizard,
                        closable: true,
                        attachToDom: this._appCtx.builderWindowRoot,
                        resizable: false
                    });
                    window.show();
                    this.connect(wizard, "_onReady", function () {
                        if (edit) {
                            this._updateConfig(properties);
                        } else {
                            this._applyConfig(properties);
                        }
                        this._updateGrid();
                        wizard.disconnect();
                        var children = wizard._queryNode.children;
                        d_array.forEach(children, function (child) {
                            var widget = d_registry.getEnclosingWidget(child);
                            widget.disconnect();
                        }, this);
                        window.close();
                    });
                    this.connect(wizard, "_onCancel", function () {
                        wizard.disconnect();
                        var children = wizard._queryNode.children;
                        d_array.forEach(children, function (child) {
                            var widget = d_registry.getEnclosingWidget(child);
                            widget.disconnect();
                        }, this);
                        window.close();
                    });
                },
                _getConfiguration: function (pid) {
                    var properties = this._properties.widgetProperties;
                    var data = this._configAdminService.getFactoryConfigurations(properties.pid, properties.bid);
                    return ct_array.arraySearchFirst(data, {
                        pid: pid
                    });
                },
                _onCreateQueryTool: function (event) {
                    var wizard = this._createWizard({});
                    ct_when(wizard, function (wizard) {
                        this._openWizardWindow(wizard, false);
                    }, this);
                },
                _onRemoveQueryTool: function (event) {
                    var ids = event.ids || [];
                    ct_when(this._windowManager.createInfoDialogWindow({
                        message: "DeleteQueryTool",
                        attachToDom: this._appCtx.builderWindowRoot
                    }), function () {
                        var store = this._getConfigStore();
                        d_array.forEach(ids, function (pid) {
                            var config = this._getConfiguration(pid);
                            if (config) {
                                config.remove();
                            }
                            store.remove(pid);
                        }, this);
                        this._updateGrid();
                    }, this);
                },
                _onEditQueryTool: function (event) {
                    var store = this._getConfigStore();
                    var config = store.get(event.id);
                    var wizard = this._createWizard(config);
                    ct_when(wizard, function (wizard) {
                        this._openWizardWindow(wizard, true);
                    }, this);
                },
                _onCopyQueryTool: function (event) {
                    var ids = event.ids || [];
                    d_array.forEach(ids, function (pid) {
                        var store = this._getConfigStore();
                        var config = store.get(pid);
                        if (config) {
                            var date = new Date();
                            config.id = "fc_" + date.getTime();
                            this._applyConfig(config);
                        }
                    }, this);
                    this._updateGrid();
                },
                _updateGrid: function () {
                    this._initConfigStore();
                    var widget = this._widget;
                    widget.updateGrid();
                },
                _getStoreData: function (stores) {
                    return ct_async.join(d_array.map(stores, function (s) {
                        return s.getMetadata();
                    })).then(function (metadata) {
                        return d_array.map(metadata, function (metadata, index) {
                            var id = stores[index].id;
                            var title = metadata.title || id;
                            return {name: title, id: id};
                        });
                    });
                }
            });
});