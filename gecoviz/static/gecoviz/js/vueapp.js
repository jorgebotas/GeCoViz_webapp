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


var vueapp = new Vue({
    delimiters: ['[[', ']]'],
    el: '#GeCoVizApp',
    data: {
        query: undefined,
        searchType: undefined,
        suggestions: [],
        selectedItems: [],
        searchedItems: [],
        suggestionTimeout: undefined,
        searchTimeout: undefined,
        allItems: [], 
        contextData: {
            newick: "",
            context: [],
        },
    },

    methods: {
        searchQuery : async function(searchType, query, options) {
            $('#spinner').modal('show');
            this.query = query || $("#search-query").val().trim() || this.query;
            $("#search-query").val(this.query);
            this.searchType = searchType || $("#search-type input:checked").val();
            d3.select(`#search-type input[value="${this.searchType}"]`)
                .attr("checked", true);
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
            if (this.allItems.length == 0)
                fetchCatch();
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
                this.searchType = $("#search-type input:checked").val();
                const search = $("#search-query").val();

                if (search.length < 3) {
                    this.suggestions = [];
                    return
                }
                
                fetch(`${API_BASE_URL}/suggestions/${this.searchType}/${search}/`)
                    .then(response => response.json())
                    .then(data => {
                        console.log(data)
                        this.suggestions = data.suggestions;
                    })
                    .catch(fetchCatch);
                
            }, 500);
        },

        updateSearch: function() {
            if (this.searchTimeout)
                clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => {
                const search = $("#search-taxonomy").val().trim().toLowerCase();
                if (search) {
                    this.searchedItems = this.allItems.filter(
                            d => d.lineage.toLowerCase().includes(search));
                    this.showAddButton(search)

                } else {
                    this.searchedItems = this.allItems.filter(d => 
                        this.selectedItems.includes(d.id));
                }

                this.searchedItems = this.searchedItems.sort((a, b) => 
                    a.split("__")[1] > b.name.split("__")[1])
            }, 500);
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
            if (!this.allItems.length)
                this.searchQuery();
            const container = $("#sunburst-selector-container")
            if (container.hasClass("show"))
                hide("#sunburst-selector-container")
            else {
                show("#sunburst-selector-container")
                d3.selectAll(".sunburst-selector *").remove();
                const taxonomy = this.allItems.map(i => [i.lineage, i.value]);
                SeqSunburst(taxonomy, 500, 6, true, this.showAddButton)
                    .draw(".sunburst-selector");
            }
        },

        async visualizeSelection() {
            hide("#sunburst-selector-container")
            const container = $("#visualization-container");
            if (container.hasClass("show"))
                hide("#visualization-container")
            else {
                show("#visualization-container")
                await this.toggleGeCoViz();
            }
        },

        toggleGeCoViz : async function() {
            const selector = "#gecoviz-container";
            $('#spinner').modal('show');
            const params = {
                query: this.query,
                searchType: this.searchType,
                taxids: this.selectedItems.join(",")
            }
            console.log(params)

            this.updateSearchParams(params);

            d3.selectAll("#gecoviz-container *").remove();

            // Fetch context data
            await this.searchContext();

            const [newick, context] = [this.contextData.newick, 
                                       this.contextData.context];
            newickFields = [
                'name',
                'last tax level',
            ]
            await GeCoViz(selector)
                .treeData(newick, newickFields[1], newickFields)
                .contextData(context)
                .nSide(4)
                .viewPort(document.querySelector(selector))
                .geneText("Gene name")
                .annotation("Orthologous groups", 2)
                .options({ shrinkTreeWidth: true })
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
        addButtonVisibility: function() {
            if (d3.select(".clone").node())
                return "visible"
            return "hidden"
        },
    },
    filters : {
    },
    mounted: function() {
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
            d3.select(`#search-type input[value="${this.searchType}"]`)
                .attr("checked", true);

            if (taxids && taxids.length) {
                this.selectedItems = taxids.split("%2C");
                this.visualizeSelection();
            } else
                this.searchQuery(searchType, query, urlParams);
        }

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

    },
});
