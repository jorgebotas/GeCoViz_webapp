var API_BASE_URL = "/api"

var colors = [
    "#9c89b8",
    "#f0a6ca",
    "#b8bedd",
    "#6B9080",
    "#A4C3B2",
    "#CCE3DE"
];

function cleanString(s) {
    let clean = String(s);
    let dirt = " \t.,;:_/\\'@<>?()[]{}#%!*|".split("");
    dirt.forEach(d => {
        clean = clean.replaceAll(d, "");
    })
    return String(clean)
}

function hideSpinner(callback) {
    setTimeout(() => {
        $('#spinner').modal('hide');
        if (callback)
            callback()
    }, 1000)
}

function fetchCatch(e) {
    if (e) console.log(e)
    hideSpinner(() => {
        setTimeout(() => {
            $('#alert').modal('show')
        }, 160);
    });
}

function show(selector) {
    $(selector).collapse("show");
    $(".accordion-button", $(selector).prev())
        .removeClass("collapsed");
    const searchbar = $(selector + " .form-control");
    if (searchbar)
        setTimeout(() => {
            searchbar.focus();
        }, 1000)
}

function hide(selector) {
    $(selector).collapse("hide");
    $(".accordion-button", $(selector).prev()).addClass("collapsed");
}

function getNameFromLineage(d) {
    const dSplit = d.split(";")
    return dSplit[dSplit.length-1]
}

function getLineage(d) {
    return d.ancestors()
        .reverse().slice(1)
        .map(d => d.data.name).join(";")
}

// Converts data to hierarchical format
const separator = ";";
function buildTaxaHierarchy(data) {
    const buildHierarchy = data => {
        const root = { name: "root", children: [] };
        for (let i = 0; i < data.length; i++) {
          const sequence = data[i][0];
          const id = +data[i][1]
          const size = +data[i][2];
          if (isNaN(size)) {
            // e.g. if this is a header row
            continue;
          }
          const parts = sequence.split(separator);
          let currentNode = root;
          for (let j = 0; j < parts.length; j++) {
            const children = currentNode["children"];
            const nodeName = parts[j];
            let childNode = null;
            if (j + 1 < parts.length) {
              // Not yet at the end of the sequence; move down the tree.
              let foundChild = false;
              for (let k = 0; k < children.length; k++) {
                if (children[k]["name"] == nodeName) {
                  childNode = children[k];
                  foundChild = true;
                  break;
                }
              }
              // If we don't already have a child node for this branch, create it.
              if (!foundChild) {
                childNode = { name: nodeName, children: [] };
                children.push(childNode);
              }
              currentNode = childNode;
            } else {
              // Reached the end of the sequence; create a leaf node.
              childNode = { name: nodeName, id: id, value: size, children: [] };
              children.push(childNode);
            }
          }
        }
        return root;
    }
    const partition = data => {
        const root = d3.hierarchy(data)
            .sum(d => d.value)
            .sort((a, b) => b.value - a.value);
        return d3.partition()
            .size([Math.PI, root.height + 1])
          (root);
    }

    const hierarchy = buildHierarchy(data);
    return partition(hierarchy);
}



var vueapp = new Vue({
    delimiters: ['[[', ']]'],
    el: '#GeCoVizApp',
    data: {
        show: "sunburst",
        query: undefined,
        searchType: undefined,
        searchTypeChoices: undefined,
        suggestions: [],
        selectedTaxids: [],
        searchedTaxa: [],
        suggestionTimeout: undefined,
        searchTimeout: undefined,
        allItems: [], 
        allTaxa: [],
        allTaxaLineages: [],
        sunBurst: undefined,
        contextData: {
            newick: "",
            context: [],
        },
        taxBadgeColors: {
            'phylum': 'bg-red-lt',
            'class': 'bg-green-lt',
            'order': 'bg-yellow-lt',
            'family': 'bg-orange-lt',
            'genus': 'bg-pink-lt',
            'species': 'bg-blue-lt',
            'subspecies': 'bg-red-lt',
            'strain': 'bg-green-lt',
        }
    },

    methods: {
        searchQuery : async function(searchType, query, options) {
            $('#spinner').modal('show');
            const newQuery = query || $("#query-search").val().trim();
            if (newQuery) {
                this.selectedTaxids = [];
                this.searchedTaxa = [];
                this.query = newQuery;
            }
            $("#query-search").val(this.query);
            this.searchType = searchType || this.searchTypeChoices.getValue(true);
            this.searchTypeChoices.setChoiceByValue(this.searchType);

            const params = {
                query: this.query,
                searchType: this.searchType,
            }
            this.updateSearchParams(params);

            $('#query-search').trigger('blur');

            await fetch(API_BASE_URL + `/emapper/${this.searchType}/${this.query}/`)
                 .then(response => response.json())
                 .then(this.fetchThen)
                 .catch(fetchCatch)
        },

        searchContext: async function () {
            async function getNewick(endpoint) {
                let newick;
                await fetch(API_BASE_URL + '/tree/' + endpoint)
                     .then(response => response.json())
                     .then(data => newick = data.tree)
                     .catch(fetchCatch)
                return newick;
            }
            async function getContext(endpoint) {
                let context;
                await fetch(API_BASE_URL + '/context/'+ endpoint)
                    .then(response => response.json())
                     .then(data => context = eval(data.context))
                     .catch(fetchCatch);
                return context;
            }

            const taxids = this.selectedTaxids.map(t => t.id).join(",");
            const endpoint = `${this.searchType}/${this.query}/${taxids}/`;

            this.contextData.newick = await getNewick(endpoint);
            this.contextData.context = await getContext(endpoint);
        },

        fetchThen : function(data, fetchURL) {
            this.allItems = data.matches;
            this.root =  buildTaxaHierarchy(this.allItems
                .map(i => [i.lineage, i.id, i.value]))
            this.root.each(d => {
                const [ rank, tname ] = d.data.name.split("__");
                d.data.rank = rank;
                d.data.tname = tname;
                d.data.lineage = getLineage(d)
            });
            this.allTaxa = this.root.descendants().slice(1);
            this.allTaxaLineages = [...new Set(this.allTaxa.map(t => t.data.lineage))]
                .map(lineage => { 
                    const [ rank, name ] = getNameFromLineage(lineage).split("__");
                    return { rank: rank, name: name, lineage: lineage }
                })
            if (this.allItems.length == 0) {
                fetchCatch();
                return;
            }
            setTimeout(() => {
                this.toggleSunburstSelector();
                this.updateSearch();
                hideSpinner();

                if (this.allItems.length <= 250) {
                    this.selectTaxa(this.root, true);
                }
            }, 0)
        },

        updateSuggestions: function() {
            if (this.suggestionTimeout)
                clearTimeout(this.suggestionTimeout);
            this.suggestionTimeout = setTimeout(() => {
                this.searchType = this.searchTypeChoices.getValue(true);
                const search = $("#query-search").val();

                if (search.length < 3) {
                    this.suggestions = [];
                    return
                }
                
                fetch(`${API_BASE_URL}/suggestions/${this.searchType}/${search}/`)
                    .then(response => response.json())
                    .then(data => {
                        this.suggestions = data.suggestions;
                    })
                    .catch(() => {
                        this.suggestions = [];
                    });
                
            }, 500);
        },

        updateSearch: function() {
            if (this.searchTimeout)
                clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => {
                const search = $("#taxa-search").val().trim().toLowerCase();

                if (search.length < 3) {
                    this.searchedTaxa = [];
                    return
                }

                this.searchedTaxa = this.allTaxa.filter(d =>
                    d.data.name.toLowerCase().includes(search))
            }, 500);
        },

        selectTaxid: function(id, source, show) {
            const isSelected = this.selectedTaxids.find(t => t.id === id);
            show = show || !isSelected;
            if (isSelected) {
                if (!show)
                    this.selectedTaxids = this.selectedTaxids.filter(
                        t => t.id != id);
            } else if (show)
                this.selectedTaxids.push({ id: id, source: source });
        },

        selectLineage: function(lineage, taxa, allDescendants=false) {
            if (allDescendants)
                this.root.leaves()
                    .filter(d => d.data.lineage.includes(lineage))
                    .forEach(d => this.selectTaxid(d.data.id, taxa, true))
            else {
                const taxid = this.root.leaves().find(
                    d => d.data.lineage.includes(lineage)).data.id;
                this.selectTaxid(taxid, taxa, true);
           }
        },

        selectLineages: function(lineages, taxa) {
            this.deselectTaxa(taxa);
            lineages.forEach(l => this.selectLineage(l, taxa));
        },

        selectTaxa: function(taxa, allDescendants=false) {
            console.log(taxa)
            this.sunBurst.highlightPath(taxa);

            if (!taxa.data.descendantLevels)
                taxa.descendantLevels = this.getDescendantLevels(taxa);
            
            const lineage = taxa.data.lineage;
            this.deselectTaxa(taxa);
            this.selectLineage(lineage, taxa, allDescendants);
        },

        deselectTaxa: function(taxa) {
            this.selectedTaxids = this.selectedTaxids.filter(t => t.source != taxa);
        },

        deselectAll: function() {
            this.selectedTaxids = [];
            this.updateSearch();
        },

        getDescendantLevels: function(d) {
            const levels = d.descendants().slice(1).reduce((ranks, d) => {
                const rank = d.data.name.split("__")[0];
                ranks[rank] = ranks[rank] || [];
                const lineage = getLineage(d);
                ranks[rank].push(lineage);
                return ranks
            }, {})

            return levels
        },

        showAddButton: function(d) {
            const container = d3.select("#add-button-container")
            container.selectAll("*").remove();

            const button = container.append("button")
                .attr("class", "btn btn-primary")
                .attr("disabled", () => this.nSelected > 250 ? true : null)
                .html("Add " + d.data.tname);
            button.on("click", () => {
                this.selectTaxa(d);
                button.remove();
            });
        },

        toggleSunburstSelector: function() {
            $("#gecoviz-navlink").removeClass("active");
            $("#sunburst-navlink").addClass("active");
            this.show = "sunburst";

            // Do not toggle if now query has been processed
            if (this.allItems.length == 0)
                this.searchQuery();

            d3.selectAll(".sunburst-selector *").remove();
            const taxonomy = this.allItems.map(d => [d.lineage, d.value]);
            this.sunBurst = SeqSunburst(taxonomy, 600, 6, true, this.showAddButton, this.root)
                .draw(".sunburst-selector");
        },

        async visualizeSelection(refresh=true) {
            const content = d3.selectAll("#gecoviz-container *").nodes();
            if (content.length && !refresh)
                this.show = "gecoviz"
            else
                await this.toggleGeCoViz();
        },

        toggleGeCoViz : async function() {
            $("#sunburst-navlink").removeClass("active");
            $("#gecoviz-navlink").addClass("active");
            this.show = "gecoviz";

            const selector = "#gecoviz-container";

            const content = d3.selectAll("#gecoviz-container *");
            if (content.nodes().length)
                content.remove();

            $('#spinner').modal('show');
            const params = {
                query: this.query,
                searchType: this.searchType,
                taxids: this.selectedTaxids.map(t => t.id).join(",")
            }

            this.updateSearchParams(params);

            // Fetch context data
            await this.searchContext();

            const [newick, context] = [this.contextData.newick, 
                                       this.contextData.context];
            newickFields = [
                'name',
                'last tax level',
                'domain',
                'phylum',
                'class',
                'order',
                'family',
                'genus',
                'species',
                'subspecies',
                'strain',
            ]
            const gecoviz = await GeCoViz(selector)
                .treeData(newick, newickFields[1], newickFields)
                .contextData(context)
                .nSide(4)
                .zoom(0.3)
                .viewPort(document.querySelector(selector))
                .geneText("Gene name")
                .annotation("Orthologous groups", 2)
                .options({ shrinkTreeWidth: true, onlyViewport: false })
                .draw();

            setTimeout(hideSpinner, 10);
            setTimeout(() => gecoviz.scaleDist, 2000);

        },

        getSeq : function(query) {
            fetch(API_BASE_URL + `/seq/${query}/`)
                .then(response => response.blob())
                .then(blob => saveAs(blob, `${query}_sequence.fasta`))
        },

        getNeighSeqs : function(query) {
            fetch(API_BASE_URL + `/neigh_seqs/${query}/`)
                .then(response => response.blob())
                .then(blob => saveAs(blob, `${query}_sequences.fasta`))
        },

        downloadNeighborhood: function() {
            const fields = ["anchor", "pos", "gene", "Gene name", 
                "Description", "strand", "start", "end", "KEGG pathways",
                "KEGG Orthology", "Orthologous groups"];
            const tsv = this.contextData.context.map(g => {
                return fields.map(f => {
                    const info = g[f];
                    return typeof info === "object" ? info.map(i => i.id) : info;
                }).join("\t")
            });

            const headedTsv = [ ...fields.join("\t"), ...tsv ].join("\n");

            saveAs(new Blob([headedTsv]), "neighborhood.tsv")
        },

        getNewick: function(query) {
            fetch(API_BASE_URL + '/tree/' + query + '/')
                .then(response => response.blob())
                .then(blob => saveAs(blob, `${query}_tree.nwx`))
        },

        getHMM: function(query) {
            fetch(API_BASE_URL + '/hmm/' + query + '/')
                .then(response => response.blob())
                .then(blob => saveAs(blob, `${query}_hmm.txt`))
        },

        updateSearchParams: function(params, replace=true) {
            const url = new URL(location);
            if (replace) url.search = '';
            const sparams = url.searchParams;
            Object.entries(params).forEach(([k, v]) => sparams.set(k, v));
            const historyObj = {
                Title: document.title,
                Url: `${url.origin}/?${sparams.toString()}`
            };
            history.pushState(historyObj, historyObj.Title, historyObj.Url);
        },

        scrollToTop: function() {
            $("html, body").animate({ scrollTop: 0 }, "slow");
        },

        focusSearchbar: function() {
            $("#query-search").focus();
            $("#visualization-container").collapse("hide");
            $("#sunburst-selector-container").collapse("hide");
        },

        toggleFullScreen: async function(selector, action=null) {
            const placeholder_div = document.getElementById("full-screen-placeholder");
            if (placeholder_div || action) {
                try { $("#full-screen .modal").modal('hide') } catch {};
                return
            }
            let modal = document.createElement("div");
            modal.id = "full-screen";
            modal.innerHTML = `
                <div class="modal modal-blur fade" 
                      tabindex="-1" 
                      aria-hidden="false">
                    <div class="modal-dialog modal-dialog-centered 
                                justify-content-center" 
                        style="min-width:97%;"
                        role="document">
                    </div>
                </div>`;
            const placeholder = document.createElement("div");
            placeholder.id = "full-screen-placeholder";
            const contentNode = document.querySelector(selector);
            const parentNode = contentNode.parentNode;
            const content = $(parentNode.replaceChild(placeholder, contentNode));
            if (!content.hasClass("modal-content"))
                content.addClass("modal-content");
            $(modal.childNodes[1].childNodes[1])
                .append(content);
            $("body").append($(modal))
            $("#full-screen .modal").on("hidden.bs.modal", () => {
                const contentDiv = $(selector);
                contentDiv.removeClass("modal-content");
                parentNode.replaceChild(contentDiv[0],
                                      placeholder);
            })
            $("#full-screen .modal").modal("show")
        },
    },
    computed: {

        isScreenLarge: function() {
            return this.isScreenLarge = +window.innerWidth > 2000;
        },

        nMatches : function() {
            return this.allItems.reduce((total, i) => total + i.value, 0);
        },

        nSelected : function() {
            const selectedTaxids = this.selectedTaxids.map(d => d.id);
            return this.allItems.reduce((total, i) => {
                if (selectedTaxids.includes(+i.id))
                    total += i.value;
                return total
            }, 0)
        },

        selectedTaxa: function() {
            return Object.values(this.selectedTaxids.reduce( (selected, t) => {
                const source = t.source || { data: { tname: t.id, lineage: t.id } };
                const lineage = source.data.lineage;
                selected[lineage] = selected[lineage] 
                    || { source: source, taxids: [] };
                selected[lineage].taxids.push(t.id);
                return selected
            }, {}))
        },

        commonSelectedTaxa: function() {
            const sharedTaxa = this.selectedTaxa.reduce((t, it, i) => {
                const itSplit = it.source.data.lineage.split(";");
                console.log(itSplit)
                if (i === 0)
                    t =  itSplit
                else
                    t = t.filter((d, i) => d === itSplit[i]);
                return t
            }, [])
            if (sharedTaxa.length > 1)
                return sharedTaxa[sharedTaxa.length-1]
            return sharedTaxa[sharedTaxa.length-1] || ""
        },

        nAnchors: function() {
            if (!this.contextData.context)
                return 0
            return this.contextData.context.filter(c => c.pos == 0).length
        }
    },
    filters : {
        styleTaxa: function(taxa) {
            if (!taxa) return 
            const [ rank, t ] = taxa.split("__");
            return `${rank}: ${t}`;
        }
    },
    mounted: function() {
        document.addEventListener("click", () => {
            if (!d3.select(".clone").node())
                d3.selectAll("#add-button-container *").remove();
        });

        ["query", "taxa"].forEach(d => {
            const searchbar = $(`#${d}-search`);
            const suggestions = $(`#${d}-suggestions`);
            searchbar.on("focus", () => {
                suggestions.css("display", "block");
            })
            searchbar.on("blur", () => {
                setTimeout(() => {
                    suggestions.css("display", "none");
                }, 100)
            })
        })


        // Choices
        const searchTypeSelect = $("#search-type");
        this.searchTypeChoices = new Choices(searchTypeSelect[0], {
            classNames: {
                containerInner: searchTypeSelect[0].className,
                input: 'form-control',
                inputCloned: 'form-control-sm',
                listDropdown: 'dropdown-menu',
                itemChoice: 'dropdown-item',
                activeState: 'show',
                selectedState: 'active',
                placeholder: 'choices__placeholder',
            },
            shouldSort: false,
            searchEnabled: false,
            choices : [
                {
                    value: 'ogs', 
                    label: 'Orthologous groups',
                    selected: this.searchType == 'ogs' 
                },
                {
                    value: 'kos', 
                    label: 'KEGG Orthology',
                    selected: this.searchType == 'kos' 
                },
                {
                    value: 'pname', 
                    label: 'Gene name',
                    selected: this.searchType == 'pname' 
                },
            ]
          });
        searchTypeSelect.change(() => this.updateSuggestions());



        // Allow searches coded in URL
        function getUrlParams() {
            const vars = {};
            window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi,
                (_,key,value) => vars[key] = value);
            return vars;
        }
        const urlParams = getUrlParams();
        const searchType = urlParams['searchType'] || 'pname';
        const query = urlParams['query'];
        const taxids = urlParams['taxids'];

        if (searchType && query) {
            this.query = query;
            this.searchType = searchType;
            
            $("#query-search").val(this.query);
            this.searchTypeChoices.setChoiceByValue(this.searchType);
            //d3.select(`#search-type inpu.split("%2C")t[value="${this.searchType}"]`)
                //.attr("checked", true);

            this.searchQuery(searchType, query, urlParams);

            if (taxids && taxids.length) {
                taxids.split("%2C").forEach(t => this.selectTaxid(t, this.root));
                console.log(this.selectedTaxids)
                this.visualizeSelection();
            }
        }
    },
});
