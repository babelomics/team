function Panel(args) {
    this.id = Utils.genId("Panel");
    this.name = "";
    this.diseases = [];
    this.genes = [];
    this.mutations = [];
    this.name = "";
    this.author = "";
    this.description = "";
    this.date = "";
    this.disease = "";
    this.version = 1;
    this.archived = false;
    this.used = false;
    this.polymer;

    _.extend(this, args);

    this.modCount = 0;

    this.hashMutations = {};
};
Panel.prototype = {
    _incModCount: function () {
        this.modCount++;
    },

    _createRetrieveTask: function (source, phenotype, include, skip, limit, mutations, numTotalResults) {
        var me = this;
        return function (cb) {
            me._retrieveMutations(source, phenotype, include, skip, limit, mutations, function (err, nr) {
                me.polymer.set('percent', Math.ceil((skip + 1) * (100 / numTotalResults)));
                console.log(me.polymer.percent);
                console.log("...............");
                if (err != null) {
                    cb(err);
                } else {
                    cb(null);
                }
            });
        }
    },

    _retrieveMutations: function (source, phenotype, include, skip, limit, mutations, rmcb) {
        var numTotalResults = 0;
        CellBaseManager.get({
            species: 'hsapiens',
            category: 'feature',
            subCategory: 'clinical',
            resource: 'search',
            params: {
                source: source,
                phenotype: phenotype,
                include: include,
                skip: skip,
                limit: limit,
            },
            success: function (data) {
                if (data.response && data.response.length > 0) {
                    numTotalResults = data.response[0].numTotalResults;
                    if (numTotalResults == -1) {
                        rmcb('Results < 0');
                    } else {
                        var result = data.response[0].result;
                        for (var i = 0; i < result.length; i++) {
                            var row = result[i];
                            var mut = {
                                chr: row.chromosome,
                                pos: row.start,
                                ref: row.reference,
                                alt: row.alternate,
                                phe: phenotype,
                                src: source
                            }
                            mutations.push(mut);
                        }
                        rmcb(null, numTotalResults);
                    }
                }
            },
            error: function () {
                rmcb("Could not connect to server.");
            }
        });
    },

    addDiseases: function (diseases, addDiseasesCallback) {
        var me = this;
        var genes = [];
        var mutations = [];

        var diseasesToProcess = [];
        for (var i = 0; i < diseases.length; i++) {
            var disease = diseases[i];
            if (!this.containsDisease(disease)) {
                diseasesToProcess.push(disease);
                delete disease._filtered;
                this.polymer.push('formData.diseases', disease);
                // this._emit("add-disease", disease);

                if (disease.associatedGenes && disease.associatedGenes.length > 0) {
                    for (var j = 0; j < disease.associatedGenes.length; j++) {
                        var assocGene = disease.associatedGenes[j];
                        if (!this._checkGenes(assocGene, this.genes)) {
                            genes.push(assocGene);
                        }
                    }
                }
            }
        }

        Utils.applyFunctionBatch(genes, 5, function (genes) {
            CellBaseManager.get({
                species: 'hsapiens',
                category: 'feature',
                subCategory: 'gene',
                resource: 'info',
                async: false,
                query: genes.join(","),
                params: {
                    include: "name,chromosome,start,end"
                },
                success: function (data) {

                    if (data.response && data.response.length > 0) {

                        for (var i = 0; i < data.response.length; i++) {
                            var geneElem = data.response[i];

                            if (geneElem.result.length > 0) {
                                var row = data.response[i].result[0];
                                var gene = {
                                    name: row.name,
                                    chr: row.chromosome,
                                    start: row.start,
                                    end: row.end
                                };
                                me.addGene(gene);

                            } else {
                                me.addGene({
                                    name: geneElem.id
                                });
                            }

                        }
                    }
                }
            });
        });
        this._incModCount();

        var createDiseaseTask = function (disease) {
            return function (diseasecb) {
                async.series([
                        function (callback) {
                            me.polymer.set('percent', 0);
                              me.polymer.set('textbar',"Adding '" + disease.phenotype + "' mutations from Clinvar...");
                            //Clinvar
                            if (disease.source == "clinvar") {
                                me._retrieveMutations("clinvar", disease.phenotype, "chromosome,start,reference,alternate,_phenotypes", 0, 1000, mutations, function (err, numTotalResults) {
                                    if (err == null) {
                                        var tasks = [];
                                        for (var n = 1000; n < numTotalResults + 1000; n += 1000) {
                                            tasks.push(me._createRetrieveTask("clinvar", disease.phenotype, "chromosome,start,reference,alternate,_phenotypes", n, 1000, mutations, numTotalResults));
                                        }
                                        async.series(tasks, function (err, results) {
                                            if (err == null) {
                                                callback(null);
                                            } else {
                                                callback("Error executing Clinvar tasks.");
                                            }
                                        });
                                    } else {
                                        callback('Failed first Clinvar call');
                                    }
                                });
                            }
                        },
                        function (callback) {
                            me.polymer.set('percent', 0);
                            me.polymer.set('textbar',"Adding '" + disease.phenotype + "' mutations from Cosmic...");
                            //Cosmic
                            // if (disease.source == "cosmic") {
                            me._retrieveMutations("cosmic", disease.phenotype, "chromosome,start,reference,alternate,_phenotypes", 0, 1000, mutations, function (err, numTotalResults) {
                                if (err == null) {
                                    var tasks = [];
                                    for (var n = 1000; n < numTotalResults + 1000; n += 1000) {
                                        tasks.push(me._createRetrieveTask("cosmic", disease.phenotype, "chromosome,start,reference,alternate,_phenotypes", n, 1000, mutations, numTotalResults));
                                    }
                                    async.series(tasks, function (err, results) {
                                        if (err == null) {
                                            callback(null);
                                        } else {
                                            callback("Error executing Cosmic tasks.");
                                        }
                                    });
                                } else {
                                    callback('Failed first Cosmic call');
                                }
                            });
                            // }
                        }
                    ],
                    // optional callback
                    function (err, results) {
                        if (err == null) {
                            // console.log(disease.phenotype + ' mutations count: ' + mutations.length);
                            diseasecb(null);
                        } else {
                            console.log(err);
                            diseasecb(err);
                        }

                    });
            }
        }

        var diseaseTasks = [];
        for (var i = 0; i < diseasesToProcess.length; i++) {
            var disease = diseasesToProcess[i];
            diseaseTasks.push(createDiseaseTask(disease))
        }
        async.series(diseaseTasks, function (err, results) {
            if (err == null) {
                console.log(' mutations count: ' + mutations.length);
                me.addMutations(mutations);
                addDiseasesCallback(null);
            } else {
                addDiseasesCallback(err);
            }
        });
    },

    addDisease: function (disease) {
        var me = this;
        if (!this.containsDisease(disease)) {
            delete disease._filtered
            this.polymer.push('formData.diseases', disease);

            if (disease.associatedGenes && disease.associatedGenes.length > 0) {
                var genes = [];
                for (var j = 0; j < disease.associatedGenes.length; j++) {
                    var assocGene = disease.associatedGenes[j];
                    if (!this._checkGenes(assocGene, this.genes)) {
                        genes.push(assocGene);
                    }
                }
                if (genes.length > 0) {

                    CellBaseManager.get({
                        species: 'hsapiens',
                        category: 'feature',
                        subCategory: 'gene',
                        resource: 'info',
                        async: false,
                        query: genes.join(","),
                        params: {
                            include: "name,chromosome,start,end"
                        },
                        success: function (data) {

                            if (data.response && data.response.length > 0) {

                                for (var i = 0; i < data.response.length; i++) {
                                    var geneElem = data.response[i];
                                    if (geneElem.result.length > 0) {
                                        var row = data.response[i].result[0];
                                        var gene = {
                                            name: row.name,
                                            chr: row.chromosome,
                                            start: row.start,
                                            end: row.end
                                        };
                                        me.addGene(gene);

                                    } else {
                                        me.addGene({
                                            name: geneElem.id
                                        });
                                    }

                                }
                            }
                        }
                    });

                }
            }

            if (disease.source == "clinvar") {
                CellBaseManager.get({
                    species: 'hsapiens',
                    category: 'feature',
                    subCategory: 'clinical',
                    // resource: 'all',
                    resource: 'search',
                    async: false,
                    params: {
                        source: 'clinvar',
                        phenotype: disease.phenotype,
                        exclude: "annot,clinvarSet"
                    },
                    success: function (data) {
                        if (data.response && data.response.length > 0) {
                            var result = data.response[0].result;
                            var mutations = [];
                            for (var i = 0; i < result.length; i++) {
                                var row = result[i];
                                var mut = {
                                    chr: row.chromosome,
                                    pos: row.start,
                                    ref: row.reference,
                                    alt: row.alternate,
                                    phe: disease.phenotype,
                                    src: disease.source
                                }
                                mutations.push(mut);
                            }
                            me.addMutations(mutations);
                        }
                    }
                });
            }

            this._incModCount();
        }
    },
    _checkGenes: function (assocGen, genes) {
        for (var j = 0; j < genes.length; j++) {
            if (assocGen == genes[j].name) {
                return true;
            }
        }
        return false;
    },
    addAllDiseases: function (diseases) {
        for (var i = 0; i < diseases.length; i++) {
            var disease = diseases[i];
            this.addDisease(disease);
        }
    },
    containsDisease: function (disease) {
        for (var i = 0; i < this.diseases.length; i++) {
            var elem = this.diseases[i];
            if (elem === disease) {
                return true;
            }
        }
        return false;
    },
    clearDiseases: function () {
        for (var i = 0; i < this.diseases.length; i++) {
            var disease = this.diseases[i];
            this.removeGenesFromDisease(disease);
            this.removeMutationsFromDisease(disease);
        }
        this.diseases = [];
        this.polymer.notifyPath('formData.diseases', this.diseases);
        this._incModCount();
    },
    clearGenes: function () {
        this.genes = [];
        this.polymer.notifyPath('formData.genes', this.genes);
        this._incModCount();
    },
    clearMutations: function () {
        this.mutations = [];
        this.polymer.notifyPath('formData.mutations', this.mutations);
        this._incModCount();
    },
    addGene: function (gene) {

        var panelGenes = [];

        for (var i = 0; i < this.genes.length; i++) {
            panelGenes.push(this.genes[i]);
        }
        var auxGene = this.containsGene(gene);

        // console.log("add gene:" + JSON.stringify(gene));

        if (auxGene) {
            auxGene.count++;
        } else {
            gene.count = 1;
            panelGenes.push(gene);
        }
        this._incModCount();
        this.polymer.set('formData.genes', panelGenes);
        this.polymer.$.geneTable.set("data", this.polymer.formData.genes);

    },
    addAllGenes: function (genes) {
        var panelGenes = [];

        for (var i = 0; i < this.genes.length; i++) {
            panelGenes.push(this.genes[i]);
        }

        for (var i = 0; i < genes.length; i++) {
            var elem = genes[i];
            var auxGene = this.containsGene(elem);

            if (auxGene) {
                auxGene.count++;
            } else {
                elem.count = 1;
                panelGenes.push(elem);
            }
            this._incModCount();
        }
        return panelGenes;
    },
    containsGene: function (gene) {
        for (var i = 0; i < this.genes.length; i++) {
            var elem = this.genes[i];
            if (elem.name === gene.name) {
                return elem;
            }
        }
        return null;
    },
    addMutations: function (mutations) {
        var panelMutations = [];

        for (var i = 0; i < this.mutations.length; i++) {
            panelMutations.push(this.mutations[i]);
        }

        for (var i = 0; i < mutations.length; i++) {
            var mutation = mutations[i];
            var auxMutation = this.containsMutation(mutation);

            if (auxMutation) {
                auxMutation.count++;
            } else {
                mutation.count = 1;
                panelMutations.push(mutation);
            }
            this._incModCount();
        }

        this.mutations = panelMutations;
        // this.polymer.set('formData.mutations', panelMutations);
        this.polymer.$.mutationTable.set("data", panelMutations);

    },
    addMutation: function (mutation) {
        var panelMutations = [];

        for (var i = 0; i < this.mutations.length; i++) {
            panelMutations.push(this.mutations[i]);
        }
        var auxMutation = this.containsMutation(mutation);

        if (auxMutation) {
            auxMutation.count++;
        } else {
            mutation.count = 1;
            panelMutations.push(mutation);
        }
        this._incModCount();
        this.mutations = panelMutations;
        // this.polymer.set('formData.mutations', panelMutations);
        this.polymer.$.mutationTable.set("data", panelMutations);
    },
    containsMutation: function (mutation) {
        var mutName = mutation.chr + "_" + mutation.pos + "_" + mutation.ref + "_" + mutation.alt + "_" + mutation.phe + "_" + mutation.src;
        if (this.hashMutations[mutName]) { // mutName in hashMutations
            return true;
        } else {
            this.hashMutations[mutName] = true;
            return false;
        }

        // for (var i = 0; i < this.mutations.length; i++) {
        //     var elem = this.mutations[i];
        //     if (elem.chr == mutation.chr &&
        //         elem.pos == mutation.pos &&
        //         elem.ref == mutation.ref &&
        //         elem.alt == mutation.alt &&
        //         elem.phe == mutation.phe &&
        //         elem.src == mutation.src) {
        //         return true;
        //     }
        // }
        // return false;
        // }
    },
    removeGenesFromDisease: function (disease) {
        if (disease.associatedGenes && disease.associatedGenes.length > 0) {
            for (var j = 0; j < disease.associatedGenes.length; j++) {
                var elem = disease.associatedGenes[j];
                if (elem.indexOf(",") >= 0) {
                    var splits = elem.split(",");
                    for (var k = 0; k < splits.length; k++) {
                        var gene = splits[k];
                        this.removeGene({
                            name: gene
                        });
                    }
                } else {
                    this.removeGene({
                        name: elem
                    });
                }
            }
        }

    },
    removeMutationsFromDisease: function (disease) {
        var mutations = [];
        for (var i = 0; i < this.mutations.length; i++) {
            var mutation = this.mutations[i];
            if (mutation.phe !== disease.phenotype) {
                mutations.push(mutation);

            }
        }
        this.polymer.set('formData.mutations', mutations);

    },
    removeGene: function (gene) {
        var index = -1;
        var g = null;
        for (var i = 0; g == null && i < this.genes.length; i++) {
            var elem = this.genes[i];
            if (elem.name === gene.name) {
                index = i;
                g = elem;
            }
        }

        if (g != null && index >= 0) {
            if (g.count > 1) {
                g.count--;
            } else {
                this.polymer.splice('formData.genes', index, 1);
            }
            this._incModCount();
        }
    },
    toJSON: function () {
        return {
            id: this.id,
            name: this.name,
            author: this.author,
            description: this.description,
            date: this.date,
            disease: this.disease,
            version: this.version,
            archived: this.archived,
            used: this.used,
            diseases: this.diseases,
            genes: this.genes,
            mutations: this.mutations
        }
    }
};

function PanelConfig(args) {
    this.id = Utils.genId("Panel");
    this.panels = [];
    this.panelHash = {};
    this.userInfo = args;
    this.polymer;

    var attrs = this.userInfo.attributes;

    if (!("team" in attrs)) {
        attrs.team = {};
    }

    if (!("panels" in attrs.team)) {
        attrs.team.panels = [];
    }

    this.panels = attrs.team.panels;

    for (var i = 0; i < this.panels.length; i++) {
        var panel = this.panels[i];
        this.panelHash[panel.fileId] = panel;
    }

    this._modCount = 0;
};
PanelConfig.prototype = {

    addPanelConfig: function (newPanelConfig) {
        if (newPanelConfig) {
            //this.panels.push(newPanelConfig);
            this.polymer.push("panelConfig.panels", newPanelConfig);
            this.panelHash[newPanelConfig.fileId] = newPanelConfig;
            this.savePanelConfig();

        }
    },
    savePanelConfig: function () {

        var url = OpencgaManager.users.update({
            id: this.userInfo.id,
            query: {
                sid: Cookies('bioinfo_sid'),
            },
            request: {
                method: "POST",
                url: true
            }
        });

        console.log(url);
        var data = {
            'attributes': {
                "team": this.userInfo.attributes.team
            }
        };

        //function createCORSRequest(method, url) {
        //    var xhr = new XMLHttpRequest();
        //    if ("withCredentials" in xhr) {
        //        xhr.open(method, url, true);
        //    } else if (typeof XDomainRequest != "undefined") {
        //        xhr = new XDomainRequest();
        //        xhr.open(method, url);
        //    } else {
        //        xhr = null;
        //    }
        //    return xhr;
        //}
        //
        //var request = createCORSRequest("POST", url);
        //if (request) {
        //    request.setRequestHeader("Content-Type", "application/json");
        //
        //    request.onload = function (e) {
        //        var response = JSON.parse(e.srcElement.response);
        //        //do something with request.responseText
        //    };
        //    request.onerror = function () {
        //        console.log("Error")
        //        debugger
        //    }
        //    request.send(JSON.stringify(data));
        //
        //}

        var xhr = new XMLHttpRequest();
        xhr.open('POST', url, true);
        // xhr.setRequestHeader("Content-Type", "text/plain");
        xhr.setRequestHeader("Content-Type", "application/json");

        xhr.onload = function (e) {
            console.log(JSON.parse(this.response));
        };
        xhr.send(JSON.stringify(data));

    },
    archivePanel: function (fileId) {
        this.panelHash[fileId].archived = !this.panelHash[fileId].archived;
        this.polymer.notifyPath('panelConfig.panels', this.panels);

        this._updatePanels();
        this.savePanelConfig();
    },
    _updatePanels: function () {
        var panels = [];
        for (var i = 0; i < this.panels.length; i++) {
            var panel = this.panels[i];
            panels.push(panel);
        }
        this.polymer.set('configPanel.panels', panels);

    }
}
