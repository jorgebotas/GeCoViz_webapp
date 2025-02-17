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

var get_newick = async (query) => {
    let newick;
    await fetch(API_BASE_URL + '/tree/' + query + '/')
         .then(response => response.text())
         .then(tree => newick = tree)
         .catch(e => console.log(e))
    return newick;
}

var get_context = async (query) => {
    let context;
    await fetch(API_BASE_URL + '/context/'+ query + '/')
        .then(response => response.json())
         .then(data => context = eval(data.context))
         .catch(e => console.log(e));
    return context;
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
        selectedItems: [],
        searchedItems: [],
        allItems: [
            {'id': 0, 'name': 'g__UBA4096', 
                'lineage': 'd__Bacteria;p__Bdellovibrionota;c__Bacteriovoracia;o__Bacteriovoracales;f__Bacteriovoracaceae;g__UBA4096', 
                'value': 4}, 
            {'id': 1, 'name': 's__UBA4096 sp002482685', 
                'lineage': 'd__Bacteria;p__Bdellovibrionota;c__Bacteriovoracia;o__Bacteriovoracales;f__Bacteriovoracaceae;g__UBA4096;s__UBA4096 sp002482685', 
                'value': 1},
            {'id': 2, 'name': 's__UBA4096 sp002422605', 
                'lineage': 'd__Bacteria;p__Bdellovibrionota;c__Bacteriovoracia;o__Bacteriovoracales;f__Bacteriovoracaceae;g__UBA4096;s__UBA4096 sp002422605',
                'value': 1}, 
            {'id': 3, 'name': 's__UBA4096 sp002381945', 
                'lineage': 'd__Bacteria;p__Bdellovibrionota;c__Bacteriovoracia;o__Bacteriovoracales;f__Bacteriovoracaceae;g__UBA4096;s__UBA4096 sp002381945',
                'value': 2},
            {'id': 4, 'name': 'g__UBA6144', 
                'lineage': 'd__Bacteria;p__Bdellovibrionota;c__Bacteriovoracia;o__Bacteriovoracales;f__Bacteriovoracaceae;g__UBA6144', 
                'value': 1},
            {'id': 5, 'name': 'f__Bacteriovoracaceae', 
                'lineage': 'd__Bacteria;p__Bdellovibrionota;c__Bacteriovoracia;o__Bacteriovoracales;f__Bacteriovoracaceae', 
                'value': 1}], 
        contextData: {
            newick: "",
            context: [],
        },
    },

    methods: {
        searchQuery : async function(searchType, query, options) {
            $('#spinner').modal('show');
            query = query || $("#search-query").val().trim();
            $("#search-query").val(query);
            const type = searchType || $("#search-type input:checked").val();
            $('#search-query').trigger('blur');

            await fetch(API_BASE_URL + `/emapper/${type}/${query}/`)
                 .then(response => response.json())
                 .then(this.fetchThen)
                 .catch(fetchCatch)

        },

        searchContext: async function () {
            async function getNewick(endpoint) {
                let newick;
                await fetch(API_BASE_URL + '/tree/' + endpoint)
                     .then(response => response.text())
                     .then(tree => newick = tree)
                     .catch(e => console.log(e))
                return newick;
            }
            async function getContext(endpoint) {
                let context;
                await fetch(API_BASE_URL + '/context/'+ endpoint)
                    .then(response => response.json())
                     .then(data => context = eval(data.context))
                     .catch(e => console.log(e));
                return context;
            }

            const endpoint = "";

            this.contextData.newick = await getNewick(endpoint);
            this.contextData.context = await getContext(endpoint);
        },

        fetchThen : function(data, fetchURL) {
            console.log(data)
            this.allItems = data;
            setTimeout(() => {
                this.toggleSunburstSelector();
                hideSpinner();
            }, 0)
        },

        updateSearch: function() {
            setTimeout(() => {
                const search = $("#search-taxonomy").val().trim().toLowerCase();
                if (!search)
                    this.searchedItems = this.selectedItems;
                else
                    this.searchedItems = this.allItems.filter(
                            d => d.name.toLowerCase().includes(search))
                        .map(d => d.id);
            }, 100);
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

        showAddButton: function(lineage) {
            const container = d3.select("#add-button-container")
            container.selectAll("*").remove();
            const button = container.append("div")
                .attr("class", "btn btn-primary")
                .attr(":visibility", "")
                .html("Add")
            button.on("click", () => {
                const matches = this.allItems
                    .filter(i => i.lineage.slice(0, lineage.length) === lineage)
                const match = matches.filter(i => i.lineage === lineage);
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
                return
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

        visualizeSelection() {
            hide("#sunburst-selector-container")
            const container = $("#visualization-container");
            if (container.hasClass("show"))
                hide("#visualization-container")
            else {
                show("#visualization-container")
                //this.toggleGeCoViz("#gecoviz-container")
            }
        },

        toggleGeCoViz : async function(selector, query, scrollPortSelector=null) {
                let newick, context;
                newick = this.subtrees[query].newick;
                context = this.subtrees[query].context;
                if (context) {
                    window.onload = () => {
                        d3.select(selector)
                            .style('opacity', 1)
                            .style('visibility', 'visible');
                        $(selector + " + div .gecoviz-progress").hide();
                    }
                } else {
                    $(selector + " + div .gecoviz-progress").show();
                    newick = await get_newick(query);
                    context = await get_context(query);
                    newickFields = [
                        'name',
                    ]
                    GeCoViz(selector)
                        .treeData(newick, newickFields[0], newickFields)
                        .contextData(context)
                        .nSide(4)
                        .scrollPort(document.querySelector(scrollPortSelector ||
                                                        ".right-panel > .row"))
                        .geneText("gene name")
                        .annotation("eggnog", 2)
                        .options({ shrinkTreeWidth: true, showLegend: false })
                        .draw();
                    d3.select(selector)
                        .style('opacity', 1)
                        .style('visibility', 'visible');
                    $(selector + " + div .gecoviz-progress").hide();
                    this.subtrees[query].newick = newick;
                    this.subtrees[query].context = context;
                }
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
        nSelected : function() {
            return this.allItems.reduce((total, i) => {
                if (i.id in this.selectedItems)
                    return total + i.value;
                return total
            }, 0)
        },
        addButtonVisibility: function() {
            if (d3.select(".clone").node())
                return "visibleo"
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
        const searchType = urlParams['searchType'] || 'fam';
        const query = urlParams['query'];

        if (searchType && query)
            this.searchQuery(searchType, query, urlParams);

        this.toggleSunburstSelector();

        document.addEventListener("click", () => {
            if (!d3.select(".clone").node())
                d3.selectAll("#add-button-container *").remove();
        })
    },
});
