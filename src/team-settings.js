function TeamSettingsView(args) {
    _.extend(this, Backbone.Events);
    this.id = Utils.genId("TeamSettingsView");

    this.data = [];
    this.diseases = [];
    this.edit = true;
    //set instantiation args, must be last
    _.extend(this, args);

    this.on(this.handlers);

    this.rendered = false;
    if (this.autoRender) {
        this.render(this.targetId);
    }
}

TeamSettingsView.prototype = {
    showImport: function () {
        this.importView.show();
    },
    show: function (edit) {

        if (this.diseases.length == 0) {
            this.diseases = this._getDiseases();
            this.allDiseases.loadData(this.diseases);
        }

        this.edit = (edit == null) ? true : edit;
        if (this.edit) {
            Ext.getCmp(this.id + "btnAddPanel").setVisible(true);
            Ext.getCmp(this.id + "btnClearPanel").setVisible(true);
            Ext.getCmp(this.id + "_panelname").enable();
        } else {
            Ext.getCmp(this.id + "btnAddPanel").setVisible(false);
            Ext.getCmp(this.id + "btnClearPanel").setVisible(false);
            Ext.getCmp(this.id + "_panelname").disable();
        }
        this.panel.show();

    },
    hide: function () {
        this.panel.hide();
    },
    render: function () {
        var _this = this;

        this.rendered = true;
        this.diseaseModel = Ext.define('DiseaseModel', {
            extend: 'Ext.data.Model',
            idProperty: 'name',
            fields: ['name']
        });

        this.geneModel = Ext.define('GeneModel', {
            extend: 'Ext.data.Model',
            idProperty: 'name',
            fields: ['name']
        });


        this.columns = this._createGridColumns();
        this.columnsGenes = this._createGridColumnsGenes();
    },
    draw: function () {
        var _this = this;
        if (!this.rendered) {
            console.info('Panel Settings Widget is not rendered yet');
            return;
        }

        /* Panel */
        this.panel = this._createPanel();
        this.importView = this._createImportPanel();
    },
    clearSettings: function () {

        var _this = this;

        _this.allDiseases.addAll(_this.primDiseases.getData());
        _this.allDiseases.addAll(_this.secDiseases.getData());

        _this.panelName.reset();
        _this.polyphen.reset();
        _this.sift.reset();
        _this.allDiseases.refresh();
        _this.primDiseases.clear();
        _this.secDiseases.clear();
        _this.diseaseGenes.clear();

    },
    load: function (panelType, panelId) {
        var _this = this;

        var query = Ext.getStore("DiseaseStore").queryBy(function (record, id) {
            return (record.get('panelType') == panelType && record.get('panelId') == panelId);
        });

        panel = query.getAt(0).raw;

        if (panel != null) {

            var edit = panelType == "user";

            var primD = [];
            var secD = [];
            var genes = [];

            Ext.each(panel.primaryDiseases, function (dis, index) {
                primD.push({name: dis.name});
            });
            Ext.each(panel.genes, function (gene, index) {
                genes.push({name: gene.name});
            });

            Ext.each(panel.secondaryDiseases, function (dis, index) {
                secD.push({name: dis.name});
            });

            _this.clearSettings();

            _this.panelName.setValue(panel.name);
            _this.polyphen.setValue(panel.polyphen);
            _this.sift.setValue(panel.sift);

            _this.primDiseases.loadData(primD);
            _this.secDiseases.loadData(secD);
            _this.diseaseGenes.loadData(genes);

            _this.show(edit);

        }

    },
    _createImportPanel: function () {

        var _this = this;

        var settings_file = Ext.create('Ext.form.field.File', {
            id: _this.id + "_settings_file",
            fieldLabel: "Settings file",
            width: 400,
            emptyText: 'Select a file',
            allowBlank: false,
            name: 'settings_file'
        });


        var window = Ext.create('Ext.window.Window', {
                title: 'Import Settings',
                height: 100,
                modal: true,
                minimizable: true,
                closable: false,
                bodyPadding: 10,
                items: [
                    settings_file
                ],
                listeners: {
                    minimize: function (win, obj) {
                        win.hide();
                    }
                },
                buttons: [
                    {
                        text: 'Import',
                        handler: function () {

                            var file = document.getElementById(settings_file.fileInputEl.id).files[0];

                            var fds_file = new FileDataSource(file);

                            fds_file.on("success", function (data) {
                                _this.parent.data = JSON.parse(data);
                                _this.parent.grid.loadData(_this.parent.data);
                                localStorage.bioinfo_panels_user_settings = JSON.stringify(_this.parent.data);
                            });

                            fds_file.fetch(true);
                            this.up('.window').hide();
                        }
                    },
                    {
                        text: 'Close',
                        handler: function () {
                            Ext.getCmp(_this.id + "_settings_file").reset();
                            this.up('.window').hide();
                            settings_file.reset();
                        }
                    }
                ]
            }
        );

        return window;
    },
    _createPanel: function () {

        var _this = this;

        var filters = {
            ftype: 'filters',
            encode: false,
            local: true,
            filters: [
                {
                    type: 'boolean',
                    dataIndex: 'visible'
                }
            ]
        };

        this.panelName = Ext.create('Ext.form.TextField',
            {
                id: _this.id + '_panelname',
                name: 'panelname',
                fieldLabel: 'Name',
                height: 20,
                maxWidth: 300,
                margin: "0 0 20 0",
                allowBlank: false
            });
        this.polyphen = Ext.create('Ext.form.NumberField',
            {
                id: _this.id + '_polyphen',
                name: 'polyphen',
                fieldLabel: 'PolyPhen',
                height: 20,
                maxWidth: 300,
                step: 0.01,
                maxValue: 1,
                minValue: 0

                //margin: "0 0 20 0"
            });
        this.sift = Ext.create('Ext.form.NumberField',
            {
                id: _this.id + '_sift',
                name: 'Sift',
                fieldLabel: 'Sift',
                height: 20,
                maxWidth: 300,
                step: 0.01,
                maxValue: 1,
                minValue: 0
                //margin: "0 0 20 0"
            });

        _this.allDiseases = _this._createAllDiseases(filters, _this.diseases);
        _this.diseaseGenes = _this._createGenesGrid("Genes");
//        _this.secGenes = _this._createGenesGrid("Secondary Genes");
        _this.primDiseases = _this._createDiseaseSetGrid("Primary Disease", _this.allDiseases, _this.diseaseGenes, filters);
        _this.secDiseases = _this._createDiseaseSetGrid("Secondary Disease", _this.allDiseases, _this.diseaseGenes, filters);

        var window = Ext.create('Ext.window.Window', {
                title: 'Settings',
                height: 600,
                width: 800,
                layout: {
                    type: 'vbox',
                    align: 'stretch'
                },
                modal: true,
                minimizable: true,
                closable: false,
                bodyPadding: 10,
                items: [
                    this.panelName,
                    {
                        xtype: 'container',
                        flex: 1,
                        layout: {
                            type: 'hbox',
                            align: 'stretch'
                        },
                        items: [
                            this.allDiseases.getPanel(),
                            {
                                xtype: 'container',
                                flex: 1,
                                layout: {
                                    type: 'vbox',
                                    align: 'stretch'
                                },
                                items: [
                                    this.primDiseases.getPanel(),
                                    this.secDiseases.getPanel()

                                ]
                            }, {
                                xtype: 'container',
                                flex: 1,
                                layout: {
                                    type: 'vbox',
                                    align: 'stretch'
                                },
                                items: [
                                    this.diseaseGenes.getPanel()
//                                    this.secGenes.getPanel()

                                ]
                            }
                        ]

                    },
                    this.polyphen,
                    this.sift
                ],
                listeners: {
                    minimize: function (win, obj) {
                        win.hide();
                    }
                },
                buttons: [
                    {
                        id: _this.id + "btnAddPanel",
                        text: 'Add Panel',
                        handler: function () {
                            window.setLoading(true);
                            if (_this.edit) {
                                var name = Ext.getCmp(_this.id + "_panelname").getValue();
                                if (name == "") {
                                    Ext.MessageBox.alert("Error", "Name is mandatory");
                                }
                                else {
                                    var polyphen = Ext.getCmp(_this.id + "_polyphen").getValue();
                                    var sift = Ext.getCmp(_this.id + "_sift").getValue();
                                    var pd = [];
                                    var sd = [];
                                    var genes = [];

                                    for (var i = 0; i < _this.primDiseases.count(); i++) {
                                        pd.push({name: _this.primDiseases.getAt(i).get("name")});
                                    }

                                    for (var i = 0; i < _this.secDiseases.count(); i++) {
                                        sd.push({name: _this.secDiseases.getAt(i).get("name")});
                                    }

                                    for (var i = 0; i < _this.diseaseGenes.count(); i++) {
                                        genes.push({name: _this.diseaseGenes.getAt(i).get("name")});
                                    }

                                    var panel = {
                                        name: name,
                                        primaryDiseases: pd,
                                        secondaryDiseases: sd,
                                        genes: genes,
                                        polyphen: polyphen,
                                        sift: sift
                                    };

                                    _this.parent.add(panel);
                                    _this.clearSettings();
                                    _this.hide();

                                    var storeAux = Ext.getStore("DiseaseStore");

                                    var query = storeAux.query("panelType", "user");
                                    var max = -1;

                                    for (var i = 0; i < query.getCount(); i++) {
                                        var elem = query.getAt(i).raw;
                                        if (elem.panelId > max) {
                                            max = elem.panelId;
                                        }
                                    }

                                    storeAux.add({
                                        panelType: 'user',
                                        panelId: max + 1,
                                        name: name,
                                        primaryDiseases: pd,
                                        secondaryDiseases: sd,
                                        genes: genes,
                                        polyphen: polyphen,
                                        sift: sift
                                    });

                                }
                            }
                            window.setLoading(false);
                        }
                    },
                    {
                        text: 'Clear',
                        id: _this.id + "btnClearPanel",
                        handler: function () {
                            if (_this.edit) {
                                _this.clearSettings();
                            }
                        }
                    },
                    {
                        text: 'Close',
                        id: _this.id + "btnClosePanel",
                        handler: function () {
                            _this.clearSettings();
                            _this.hide();
                        }
                    }
                ]
            }
        );
        return window;
    },
    _createGridColumns: function () {
        var columns = [
            {
                text: "Name",
                flex: 1,
                sortable: true,
                groupable: true,
                dataIndex: 'name',
                filter: {
                    type: 'string'
                },
                summaryType: 'count',
                editor: {
                    allowBlank: false
                }
            },
        ];
        return columns;
    },
    _createGridColumnsGenes: function () {
        var columns = [
            {
                text: "Name",
                flex: 1,
                sortable: true,
                groupable: true,
                dataIndex: 'name',
                filter: {
                    type: 'string'
                },
                summaryType: 'count',
                editor: {
                    allowBlank: false
                }
            },
            {
                xtype: 'actioncolumn',
                width: 40,
                tdCls: 'delete',
                items: [
                    {
                        icon: Utils.images.del,  // Use a URL in the icon config
                        tooltip: 'Delete',
                        handler: function (grid, rowIndex, colIndex) {
                            var rec = grid.getStore().getAt(rowIndex);
                            alert("Delete " + rec.get('name'));
                            grid.getStore().removeAt(rowIndex);
                        }
                    }
                ]
            }
        ];
        return columns;
    },
    _createAllDiseases: function (filters, data) {

        var _this = this;

        var allDiseases = new Grid();
        allDiseases.model = this.diseaseModel;
        allDiseases.store = Ext.create('Ext.data.Store', {
            model: allDiseases.model,
            data: data,
            remoteSort: false,
            sorters: [
                {
                    property: 'name',
                    direction: 'ASC'
                }
            ],
            groupField: 'name'
        });

        allDiseases.grid = Ext.create('Ext.grid.Panel', {
            viewConfig: {
                plugins: {
                    ptype: 'gridviewdragdrop',
                    dragGroup: 'firstGridDDGroup',
                    dropGroup: 'secondGridDDGroup'
                },
                listeners: {
                    drop: function (node, data, dropRec, dropPosition) {
                        if (_this.edit) {
                            this.getStore().sort('name', 'ASC');
                        }
                    }
                }
            },
            tools: [
                {
                    type: 'refresh',
                    tooltip: 'Settings',
                    handler: function (event, toolEl, panel) {
                        if (_this.edit) {
                            _this.allDiseases.loadData(_this.diseases);
                            _this.primDiseases.removeAll();
                            _this.secDiseases.removeAll();
                        }
                    }
                }
            ],
            features: [
                filters
            ],
            store: allDiseases.store,
            columns: this.columns,
            stripeRows: true,
            title: "Diseases",
            margins: '0 2 0 0',
            flex: 1,
            height: "80%",
            multiSelect: true,
            margin: '0 15 10 0'
        });

        return allDiseases;
    },
    _createDiseaseSetGrid: function (title, mainGrid, geneGrid, filters) {

        var _this = this;

        var newGrid = new Grid();

        newGrid.model = _this.diseaseModel;
        newGrid.store = Ext.create('Ext.data.Store', {
            model: newGrid.model,
            remoteSort: false,
            sorters: [
                {
                    property: 'name',
                    direction: 'ASC'
                }
            ]
        });

        newGrid.grid = Ext.create('Ext.grid.Panel', {
                viewConfig: {
                    plugins: {
                        ptype: 'gridviewdragdrop',
                        dragGroup: 'secondGridDDGroup',
                        dropGroup: 'firstGridDDGroup'
                    },
                    listeners: {
                        drop: function (node, data, dropRec, dropPosition) {

                            _this.allDiseases.setLoading(true);
                            _this.primDiseases.setLoading(true);
                            _this.secDiseases.setLoading(true);
                            _this.diseaseGenes.setLoading(true);

                            this.getStore().sort('name', 'ASC');

                            var diseases = data.records;

                            for (var i = 0; i < diseases.length; i++) {

                                var disName = diseases[i].data.name;

                                $.ajax({
                                    url: "http://ws-beta.bioinfo.cipf.es/cellbase/rest/v3/hsapiens/feature/snp/phenotypes?phenotype=" + disName,
                                    dataType: 'json',
                                    async: false,
                                    success: function (response, textStatus, jqXHR) {

                                        var genes = [];

                                        for (var i = 0; i < response.response.numResults; i++) {
                                            var dis = response.response.result[i];

                                            for (var j = 0; j < dis.associatedGenes.length; j++) {
                                                genes.push({name: dis.associatedGenes[j]
                                                });
                                            }
                                        }

                                        _this.diseaseGenes.add(genes);
                                        _this.allDiseases.setLoading(false);
                                        _this.primDiseases.setLoading(false);
                                        _this.secDiseases.setLoading(false);
                                        _this.diseaseGenes.setLoading(false);

                                    },
                                    error: function (jqXHR, textStatus, errorThrown) {
                                        console.log('Error loading Genes');
                                        _this.allDiseases.setLoading(false);
                                        _this.primDiseases.setLoading(false);
                                        _this.secDiseases.setLoading(false);
                                        _this.diseaseGenes.setLoading(false);
                                    }
                                });


                            }


                            _this.diseaseGenes.grid.getStore().sort('name', 'ASC');
                        }
                    }
                },
                store: newGrid.store,
                columns: this.columns,
                stripeRows: true,
                title: title,
                margins: '0 0 0 3',
                flex: 1,
                multiSelect: true,
                hideHeaders: true,
                tools: [
                    {
                        type: 'refresh',
                        tooltip: 'Clear',
                        handler: function (event, toolEl, panel) {
                            if (_this.edit) {
                                mainGrid.addAll(newGrid.getData());
                                mainGrid.refresh();
                                newGrid.removeAll();
                            }
                        }
                    }
                ],
                margin: '0 15 10 0',
                plain: true
            }
        );

        return newGrid;
    },
    _createGenesGrid: function (title) {

        var _this = this;

        var newGrid = new Grid();

        newGrid.model = _this.geneModel;
        newGrid.store = Ext.create('Ext.data.Store', {
            model: newGrid.model,
            remoteSort: false,
            sorters: [
                {
                    property: 'name',
                    direction: 'ASC'
                }
            ]
        });

        var rowEditing = Ext.create('Ext.grid.plugin.RowEditing', {
            clicksToMoveEditor: 1,
            autoCancel: false
        });

        newGrid.grid = Ext.create('Ext.grid.Panel', {
                store: newGrid.store,
                columns: this.columnsGenes,
                stripeRows: true,
                title: title,
                margins: '0 0 10 0',
                flex: 1,
                tools: [
                    {
                        type: 'refresh',
                        tooltip: 'Clear',
                        handler: function (event, toolEl, panel) {
                            if (_this.edit) {
                                _this.diseaseGenes.removeAll();
                            }
                        }
                    },
                    {
                        type: 'plus',
                        tooltip: 'Add Gene',
                        handler: function (event, toolEl, panel) {
                            if (_this.edit) {
                                rowEditing.cancelEdit();

                                // Create a record instance through the ModelManager
                                var r = Ext.create('GeneModel', {
                                    name: 'New Gene'
                                });

                                newGrid.insert(newGrid.count(), r);
                                rowEditing.startEdit(newGrid.getAt(newGrid.count() - 1), 0);

                            }
                        }
                    }
                ],
                dockedItems: [
                    {
                        xtype: 'toolbar',
                        dock: 'bottom',
                        items: [
                            '->',
                            {
                                xtype: 'button',
                                text: 'New Gene',
                                handler: function () {
                                    console.log(newGrid.count());
                                    if (_this.edit) {
                                        rowEditing.cancelEdit();

                                        // Create a record instance through the ModelManager
                                        var r = Ext.create('GeneModel', {
                                            name: 'New Gene'
                                        });

                                        newGrid.insert(newGrid.count(), r);
                                        rowEditing.startEdit(newGrid.getAt(newGrid.count() - 1), 0);

                                    }
                                }
                            }
                        ]
                    }
                ],
                plugins: [rowEditing],
                hideHeaders: true
            }
        );

        return newGrid;

    },
    _getDiseases: function () {
        console.log("getDis");
        var data = [];
        $.ajax({
            url: "http://ws-beta.bioinfo.cipf.es/cellbase/rest/v3/hsapiens/feature/snp/phenotypes?exclude=associatedGenes",
//            url: "http://ws-beta.bioinfo.cipf.es/cellbase/rest/v3/hsapiens/feature/snp/phenotypes?exclude=associatedGenes&limit=5",
            dataType: 'json',
            async: false,
            success: function (response, textStatus, jqXHR) {
                for (var i = 0; i < response.response.result.length; i++) {
                    var disease = response.response.result[i].phenotype;
                    data.push(
                        {
                            value: disease,
                            name: disease
                        });
                }

            },
            error: function (jqXHR, textStatus, errorThrown) {
                console.log('Error loading Diseases');

            }
        });

        return data;
    }
}
;
