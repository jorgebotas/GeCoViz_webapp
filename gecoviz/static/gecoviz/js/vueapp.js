var API_BASE_URL = "/api"

var colors = [
    "#9c89b8",
    "#f0a6ca",
    "#b8bedd",
    "#6B9080",
    "#A4C3B2",
    "#CCE3DE"
];

var cleanString = function(s) {
    let clean = String(s);
    let dirt = " \t.,;:_/\\'@<>?()[]{}#%!*|".split("");
    dirt.forEach(d => {
        clean = clean.replaceAll(d, "");
    })
    return String(clean)
}

var hideSpinner = function(callback) {
    setTimeout(() => {
        $('#spinner').modal('hide');
        if (callback)
            callback()
    }, 1000)
}

var fetchCatch = function(e) {
    if (e) console.log(e)
    hideSpinner(() => {
        setTimeout(() => {
            $('#alert').modal('show')
        }, 160);
    });
}

var show = function (selector) {
    $(selector).collapse("show");
    $(".accordion-button", $(selector).prev())
        .removeClass("collapsed");
    const searchbar = $(selector + " .form-control");
    if (searchbar)
        setTimeout(() => {
            searchbar.focus();
        }, 1000)
}

var hide = function (selector) {
    $(selector).collapse("hide");
    $(".accordion-button", $(selector).prev()).addClass("collapsed");
}

function getNameFromLineage(d) {
    const dSplit = d.split(";")
    return dSplit[dSplit.length-1]
}

function getLineage(d) {
    d.ancestors()
        .map(d => d.data.name)
        .reverse().join(";")
}

// Converts data to hierarchical format
const separator = ";";
function buildTaxaHierarchy(data) {
    const buildHierarchy = data => {
        const root = { name: "root", children: [] };
        for (let i = 0; i < data.length; i++) {
          const sequence = data[i][0];
          const size = +data[i][1];
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
              childNode = { name: nodeName, value: size, children: [] };
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
        query: undefined,
        searchType: undefined,
        searchTypeChoices: undefined,
        suggestions: [],
        selectedItems: [],
        searchedTaxa: [],
        suggestionTimeout: undefined,
        searchTimeout: undefined,
        allItems: [], 
        allTaxa: [],
        allTaxaLineages: [],
        contextData: {
            newick: "",
            context: [],
        },
    },

    methods: {
        searchQuery : async function(searchType, query, options) {
            $('#spinner').modal('show');
            const newQuery = query || $("#search-query").val().trim();
            if (newQuery) {
                this.selectedItems = [];
                this.searchedTaxa = [];
                this.query = newQuery;
            }
            $("#search-query").val(this.query);
            this.searchType = searchType || this.searchTypeChoices.getValue(true);
            this.searchTypeChoices.setChoiceByValue(this.searchType);

            const params = {
                query: this.query,
                searchType: this.searchType,
            }
            this.updateSearchParams(params);

            $('#search-query').trigger('blur');

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

            const taxids = this.selectedItems.join(",");
            const endpoint = `${this.searchType}/${this.query}/${taxids}/`;

            this.contextData.newick = await getNewick(endpoint);
            this.contextData.context = await getContext(endpoint);
        },

        fetchThen : function(data, fetchURL) {
            this.allItems = data.matches;
            this.allTaxa = buildTaxaHierarchy(this.allItems
                .map(i => [i.lineage, i.value])).descendants().slice(1);
            this.allTaxa.forEach(d => d.lineage = getLineage(d));
            this.allTaxaLineages = [...new Set(this.allTaxa.map(t => t.lineage))]
                .map(lineage => { 
                    console.log(lineage)
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
            }, 0)
        },

        updateSuggestions: function() {
            if (this.suggestionTimeout)
                clearTimeout(this.suggestionTimeout);
            this.suggestionTimeout = setTimeout(() => {
                this.searchType = this.searchTypeChoices.getValue(true);
                const search = $("#search-query").val();

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
                const search = $("#search-taxonomy").val().trim().toLowerCase();

                if (search.length < 3) {
                    this.searchedTaxa = [];
                    return
                }

                this.searchedTaxa = this.allTaxaLineages.filter(d =>
                    d.name.toLowerCase().includes(search))
                console.log(this.searchedTaxa)
            }, 500);
        },

        selectTaxa: function(lineage, allDescendants=false) {
            if (allDescendants)
                this.allItems
                    .filter(d => d.lineage.includes(lineage))
                    .forEach(d => this.selectItem(d.id, true))
            else {
                const taxid = this.allItems.find(
                    d => d.lineage.includes(lineage)).id;
                this.selectItem(taxid, true);
            }
        },

        selectItem: function(id, show) {
            show = show || !this.selectedItems.includes(id);
            if (this.selectedItems.includes(id)) {
                if (!show)
                    this.selectedItems = this.selectedItems.filter(
                        s => s != id);
            } else if (show)
                this.selectedItems.push(id);

            this.updateSearch();
        },

        deselectAll: function() {
            this.selectedItems = [];
            this.updateSearch();
        },

        getDescendantLevels: function(target) {
            const levels = target.descendants().slice(1).reduce((ranks, d) => {
                const rank = d.data.name.split("__")[0];
                ranks[rank] = ranks[rank] || [];
                const lineage = getLineage(d);
                ranks[rank].push(lineage);
                return ranks
            }, {})
            console.log(levels)
        },

        showAddButton: function(lineage) {
            const container = d3.select("#add-button-container")
            container.selectAll("*").remove();

            const matches = this.allItems
                .filter(i =>  i.lineage.includes(lineage))//)i.lineage.slice(0, lineage.length) === lineage)
            const match = matches.filter(i => i.lineage === lineage);

            const toBeSelected = match.length ? +match[0].value : 
                +matches.reduce((total, i) => total + i.value, 0);
            const totalSelected = this.nSelected + toBeSelected;

            const button = container.append("button")
                .attr("class", "btn btn-primary")
                .attr("disabled", () => totalSelected > 250 ? true : null)
                .html("Add " + toBeSelected);
            button.on("click", () => {
                if (match.length)
                    this.selectItem(match[0].id, true);
                else
                    matches.forEach(item => this.selectItem(item.id, true));
                button.remove();
            });
        },

        toggleSunburstSelector: function() {
            hide("#visualization-container");
            // Do not toggle if now query has been processed
            if (this.allItems.length == 0)
                this.searchQuery();
            const container = $("#sunburst-selector-container")
            if (container.hasClass("show"))
                hide("#sunburst-selector-container")
            else {
                show("#sunburst-selector-container")
                d3.selectAll(".sunburst-selector *").remove();
                const taxonomy = this.allItems.map(i => [i.lineage, i.value]);
                SeqSunburst(taxonomy, 500, 6, true, this.getDescendantLevels)
                    .draw(".sunburst-selector");
            }
        },

        async visualizeSelection(refresh=true) {
            hide("#sunburst-selector-container")
            const container = $("#visualization-container");
            if (container.hasClass("show"))
                hide("#visualization-container")
            else {
                show("#visualization-container")

                if (refresh)
                    await this.toggleGeCoViz();
            }
        },

        toggleGeCoViz : async function() {
            const selector = "#gecoviz-container";

            const content = d3.selectAll("#gecoviz-container *");
            if (content.nodes().length) {
                content.remove();
                return
            }

            $('#spinner').modal('show');
            const params = {
                query: this.query,
                searchType: this.searchType,
                taxids: this.selectedItems.join(",")
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
            await GeCoViz(selector)
                .treeData(newick, newickFields[1], newickFields)
                .contextData(context)
                .nSide(4)
                .viewPort(document.querySelector(selector))
                .geneText("Gene name")
                .annotation("Orthologous groups", 2)
                .options({ shrinkTreeWidth: true, onlyViewport: false })
                .draw();

            setTimeout(hideSpinner, 10);

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
            $("#search-query").focus();
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
        nMatches : function() {
            return this.allItems.reduce((total, i) => total + i.value, 0);
        },
        nSelected : function() {
            return this.allItems.reduce((total, i) => {
                if (this.selectedItems.includes(i.id))
                    return total + i.value;
                return total
            }, 0)
        },
        selectedTaxa: function() {
            const sharedTaxa = this.searchedTaxa.reduce((t, it, i) => {
                const itSplit = it.lineage.split(";")
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
        })

        const searchbar = $("#search-query");
        const suggestions = $("#search-suggestions");
        searchbar.on("focus", () => {
            suggestions.css("display", "block");
        })
        searchbar.on("blur", () => {
            setTimeout(() => {
                suggestions.css("display", "none");
            }, 100)
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
            
            $("#search-query").val(this.query);
            this.searchTypeChoices.setChoiceByValue(this.searchType);
            //d3.select(`#search-type input[value="${this.searchType}"]`)
                //.attr("checked", true);

            if (taxids && taxids.length) {
                this.selectedItems = taxids.split("%2C");
                this.visualizeSelection();
            } else
                this.searchQuery(searchType, query, urlParams);
        }
    },
});
