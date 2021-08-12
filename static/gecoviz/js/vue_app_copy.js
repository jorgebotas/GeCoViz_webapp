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

var draw_protDomains = function(selector, domains, lenseq, width, height, palette) {
    function scale(num, inSize, outSize) {
        return +num * outSize / inSize;
    }
    function draw_seqLine(g, width, height) {
        g.append("line")
            .attr("stroke", "black")
            .attr("stroke-width", 2)
            .attr("x1", 0)
            .attr("y1", height / 2)
            .attr("x2", width)
            .attr("y2", height / 2);
    }
    function draw_legend(selector, domains, palette) {
        var legend = d3.select(selector)
         .append("div")
         .attr("class", "d-block px-3");
        var doms = new Set();
        domains.forEach(d => {
            if (d.class && d.class != "") {
                doms.add(d.class)
            }
        })
        doms.forEach(d => {
            let l = legend.append("div")
                     .attr('class', 'd-inline px-2');
            l.append('svg')
             .attr('width', 10)
             .attr('height', 10)
             .attr('class', 'mr-2')
             .append('circle')
             .attr("r", 5)
             .attr("cx", 5)
             .attr("cy", 5)
             .attr("fill", palette(d));
            l.append('div')
             .attr('class', 'd-inline')
             .text(d)
        })
    }
    function draw_domains(g, domains, lenseq, width, height, palette) {
        g.selectAll('circle')
            .data(domains.filter(d => d.shape == "circle" ))
            .enter().append('circle')
            .attr("r", 4)
            .attr("cx", function (d) { return scale(+d.c, lenseq, width); })
            .attr("cy", height/2)
            .attr("fill", d => { return palette(d.class) });
        g.selectAll('rect')
            .data(domains.filter(d => d.shape == "rect" ))
            .enter().append('rect')
            .attr("x", function (d) {return scale(+d.start, lenseq, width); })
            .attr("y", 0)
            .attr("width", function (d) { return scale(+d.end - +d.start, lenseq, width); })
            .attr("height", height)
            .attr("fill", d => { return palette(d.class) });
    }
    var g = d3.select(selector)
              .append("div")
              .append('svg:svg')
              .attr("width", width)
              .attr("height", height)
              .append('svg:g')
                .attr("transform", "translate(" + 5 + ", 0)");
    draw_seqLine(g, width, height);
    draw_domains(g, domains, lenseq, width, height, palette);
    draw_legend(selector + ' div', domains, palette);
}

var drawDonuts = async function(f, data) {
    var biomes_id = 'f' + f + '-biomesViz';
    var biomes = data.biomes;
    var mags_id = 'f' + f + '-magsDonut';
    var mags = data.mags;
    renderDonut(biomes_id,
                [
                "Marine",
                "Human vagina",
                "Fresh water",
                "Soil",
                "Pig gut",
                "Mouse gut",
                "Built environment",
                "Human skin",
                "Human nose",
                "Dog gut",
                "Cat gut",
                "Human gut",
                "Waste water",
                "Human oral"
                ],
                Object.values(biomes),
                colors);
    renderDonut(mags_id,
                [
                "Human gut",
                "Marine",
                "TARA Eukaryote",
                "Earth",
                ],
                Object.values(mags).map(m => m.length),
                colors.slice(0, 4))
}

var renderDonut = function(id, labels, vals, colors, legend='bottom', height=240, width=450) {
    let div = document.getElementById(id);
    options = {
        chart: {
            type: "donut",
            fontFamily: 'inherit',
            width: width,
            height: height,
            sparkline: {
                enabled: true
            },
            animations: {
                enabled: false
            },
        },
        fill: {
            opacity: 1,
        },
        series: vals,
        labels : labels,
        grid: {
            strokeDashArray: labels.length,
        },
        colors: colors,
        legend: {
            show : legend,
        },
        tooltip: {
            fillSeriesColor: false
        },
        plotOptions: {
            pie: {
                expandOnClick: false,
            }
        }
    }
    var chart = new ApexCharts(div, options);
    chart.render();

}

var renderDomains = function(domains, outerSelector) {
    var doms = new Set();
    domains.forEach(dom => {
        dom.doms.forEach(d => {
            if (d.class && d.class != "")
                doms.add(d.class)
        })
    })
    doms = [...doms];
    var colors = [
        '#6574cd',
        '#e6ac00',
        '#ffa3b2',
        "#254F93",
        "#c9b2fd",
        "#fcaf81",
        "#a9dff7",
        "#FF5C8D",
        "#838383",
        "#5F33FF",
        "#c7e3aa",
        "#abfdcb",
        "#D81E5B",
        "#47DAFF",
        "#c4ab77",
        "#A1A314",
        "#fff600",
        "#53257E",
        "#1e90ff",
        "#B6549A",
        "#7cd407",
        "#948ad6",
        "#7ba0d5",
        "#fcc6f8",
        "#fec24c",
        "#A40E4C",
        "#dd5a95",
        "#12982d",
        "#27bda9",
        "#F0736A",
        "#9354e7",
        "#cbd5e3",
        "#93605D",
        "#FFE770",
        "#6C9D7F",
        "#2c23e4",
        "#ff6200",
        "#406362"
          ]
    if (doms.includes('helix'))
        doms = ['helix', ...doms.filter(d => d != 'helix')];
    else
        colors = colors.slice(1);
    var palette = d3.scaleOrdinal()
                    .domain(doms)
                    .range(colors);
    domains.forEach(d => {
        selector = outerSelector + " #d" + cleanString(d.gene);
        const container = d3.select(selector);
        container.selectAll('*').remove();
        if (d.doms.length > 0)
            draw_protDomains(selector, d.doms, d.lenseq, 600, 10, palette);
    });
}

var renderSunburst = function(selector, data) {
    SeqSunburst(data, 200, selector);
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


var vueapp = new Vue({
    delimiters: ['[[', ']]'],
    el: '#NovelFams',
    data: {
        subtrees: {},
        orderedSubtrees: {},
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
        currentPage: 1,
        perPage: 10,
        totalItems: 1,
        nPages: 1,
        currentSearch: '',
        examples: {
            ko: [],
            synapo: [],
            card: [],
        },
    },
    methods: {
        searchQuery : async function(searchType, query, options) {
            $('#spinner').modal('show');
            this.subtrees = {};
            this.orderedSubtrees = {};
            this.nPages = 1;
            this.totalItems = 0;
            this.currentPage = options && options.page ? options.page : 1;
            query = query || $("#search-fams").val().trim();
            $("#search-fams").val(query);
            const type = searchType || $("#search-type input:checked").val();
            $('#search-fams').trigger('blur');

            if (type == 'og') {
            } else if (type == 'ko') {
            } else if (type == 'pname') {
            }
        },

        searchByPreferedName : function(query) {
            const searchParams = {
                searchType: 'pname',
                query: query,
                page: this.currentPage,
            };
            fetch(API_BASE_URL + `/pname/${query}/`)
                .then(response => response.json())
                .then(data => this.fetchThen(data, ''))
                .then(() => this.updateSearchParams(searchParams))
                .catch(e => fetchCatch(e));
        },

        searchFamByFunction : function(query, options) {
            const queryType = options && options.fnType
                ? options.fnType
                : $('.term-type input:checked').val();
            const conservation = options && +options.conservation >= 0
                ? options.conservation 
                : document
                .querySelector("#conservation")
                .noUiSlider.get();
            const minRelDist = options && +options.mindist >= 0
                ? options.mindist 
                : parseInt(document.querySelector("#mindist")
                    .noUiSlider.get());
            const searchParams = {
                searchType: 'function',
                query: query,
                fnType: queryType,
                conservation: conservation,
                minDist: minRelDist,
                page: this.currentPage,
            }
            const fetchURL = API_BASE_URL
                + `/fnfams/${queryType}/${query}/${minRelDist}/${conservation}`;
            fetch(`${fetchURL}/${this.currentPage}/`)
                .then(response => response.json())
                .then(data => this.fetchThen(data, fetchURL))
                .then(() => this.updateSearchParams(searchParams))
                .catch(e => fetchCatch(e))
        },

        searchByOG: function(query) {
            const searchParams = {
                searchType: 'og',
                query: query,
                page: this.currentPage,
            };
            fetch(API_BASE_URL + `/subtrees/${query}/`)
                .then(response => response.json())
                .then(data => this.fetchThen(data, ''))
                .then(() => this.updateSearchParams(searchParams))
                .then(() => this.toggleGeCoViz(".left-panel .card-body",
                                               "COG4775_1",
                                               ".left-panel > .card-body"))
                .catch(e => fetchCatch(e));

        },

        updateSubtrees: function(subtrees) {
            this.orderedSubtrees = {};
            this.orderedSubtrees = subtrees;
            this.subtrees = {};
            Object.entries(subtrees).forEach(([k, v]) => {
                this.subtrees[k] = { info: v.info };
                Object.entries(v.subtrees).forEach(([k, v]) => {
                    this.subtrees[k] = { info: v.info };
                });
            });
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
                .html("Add");
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

        fetchThen : function(data, fetchURL) {
            // Hide search filters quickly
            document.querySelectorAll('.search-filters')
                .forEach(f => f.classList.remove('show'));
            this.updateSubtrees(data.subtrees);
            this.currentSearch = fetchURL;
            this.totalItems = +data.total_matches;
            this.nPages = Math.ceil(this.totalItems/this.perPage)
            if (this.totalItems == 0)
                fetchCatch();
            setTimeout(() => {
                if(this.totalItems == 1)
                    this.showAllFams();
                else
                    this.hideAllFams();
                //this.paginateInfo();
                this.renderFamInfo();
                hideSpinner();
            }, 0)
        },

        paginateInfo : function() {
            function paginate(field, perPage) {
                const nItems = field.length;
                const nPages = Math.ceil(nItems / perPage);
                const itemsToShow = nPages > 1
                    ? field.slice(0, perPage)
                    : field;
                return {
                    subtrees: itemsToShow,
                    items: field,
                    nPages: nPages,
                    perPage: perPage,
                    currentPage: 1
                }
            }
            const perPage = this.perPage;
            Object.entries(this.subtrees).forEach(([f, data]) => {
                const members = data.members;
                this.subtrees[f].members = paginate(members, perPage);
            })
        },

        renderFamInfo : function() {
            Object.entries(this.subtrees).forEach(([f, data]) => {
                const idx = Object.keys(this.subtrees).indexOf(f);
                // Sources donut
                const sources = data.info.sources
                if (sources)
                    renderDonut('f'+f+'-sources',
                        Object.keys(sources),
                        Object.values(sources),
                        colors,
                        'bottom',
                        65,
                        250)
                // Genomic context overview
                const summary = data.info.context_summary;
                if (summary) {
                    const gecovizSelector = `#f${f}-GeCoViz-summary`;
                    GeCoViz(gecovizSelector, { geneRect: { h: 20 } })
                        .contextData(summary)
                        .nSide(2)
                        .geneText("gene name")
                        .annotation("eggnog", 2)
                        .options({
                            'showTree': false,
                            'showBar': false,
                            'showLegend': false,
                            'onlyViewport': false,
                        })
                        .shuffleColors()
                        .draw();
                    const gecovizSummary = d3.select(gecovizSelector);
                    gecovizSummary
                        .select('.graph-container')
                        .style('max-height', '50px');
                    gecovizSummary
                        .selectAll('.innerContainer')
                        .style('border', 'none');
                    gecovizSummary
                        .style('opacity', 1)
                        .style('visibility', 'visible');
                }

                // Render protein topologies
                if (data.domains)
                    setTimeout(() => renderDomains(data.domains, `#f${f}`), 0)

                // Render sunbursts
                if (data.taxonomy) {
                    const sunburstSelector = `#f${f}-taxSunburst`
                    SeqSunburst(data.taxonomy, 400)
                        .draw(sunburstSelector);
                }
            });
        },

        showExamples: async function(exampleType) {
            if (this.examples[exampleType].length > 0)
                return this.examples[exampleType]
            let fetchURL = API_BASE_URL
                + `/examples/${exampleType}/info`;
            await fetch(`${fetchURL}/0/`)
                .then(response => response.json())
                .then(data => this.examples[exampleType] = data.subtrees)
                .catch(e => fetchCatch(e))
            return this.examples[exampleType]
        },

        showAllFams : function() {
            Object.keys(this.subtrees).forEach((f, idx) => {
                let selector = `#f${f}-GeCoViz`;
                this.toggleGeCoViz(selector, f)
            });
            $('.tab-content').collapse('show');
        },

        hideAllFams : function() {
            $('.tab-content').collapse('hide');
        },

        toggleFam : function(id, action='show') {
            $("#" + id).collapse(action);
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

        getSeqs : function(query) {
            fetch(API_BASE_URL + `/seqs/${query}/`)
                .then(response => response.blob())
                .then(blob => saveAs(blob, `${query}_sequences.fasta`))
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

        getCardPage : function(page, query, field) {
            const d = this.subtrees[query][field];
            if (page == 'previous') {
                page = d.currentPage > 1
                    ? d.currentPage - 1
                    : 1;
            } else if (page == 'next') {
                page = d.currentPage < d.nPages
                    ? d.currentPage + 1
                    : d.nPages;
            }
            const itemsToShow = d.items.slice(d.perPage*(page-1), d.perPage*page);
            this.subtrees[query][field].subtrees = [];
            this.subtrees[query][field].subtrees = itemsToShow;
            this.subtrees[query][field].currentPage = page;
            if (field == "members") {
                const idx = Object.keys(this.subtrees).indexOf(query);
                setTimeout(() => {
                    renderDomains(this.subtrees[query].domains
                            .filter(d => itemsToShow.includes(d.gene)),`#f${idx}`);
                }, 0)
            }
        },

        getPage: function(page) {
            this.subtrees = {};
            $('#spinner').modal('show');
            if (page == 'previous') {
                page = this.currentPage > 1
                    ? this.currentPage - 1
                    : 1;
            } else if (page == 'next') {
                page = this.currentPage < this.nPages
                    ? this.currentPage + 1
                    : this.nPages;
            }
            let fetchURL = this.currentSearch;
            fetch(`${fetchURL}/${page}/`)
                .then(response => response.json())
                .then(data => {
                    this.updateSubtrees(data.subtrees);
                    this.currentSearch = fetchURL;
                    this.currentPage = page;
                    this.totalItems = +data.total_matches;
                    this.nPages = Math.ceil(this.totalItems/this.perPage);
                    hideSpinner();
                })
                .then(() => {
                    this.hideAllFams();
                    this.paginateInfo();
                    this.renderFamInfo();
                    this.scrollToTop();
                    this.updateSearchParams({page: page}, false);
                })
                .catch(e => fetchCatch(e))
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

        showSearchFilters: function(searchType, query) {
            $("#search-filters").collapse("show");
        },

        toggleSearchFilters: async function() {
            const searchTypeSelect = $('#search-type');
            const val = searchTypeSelect.val();
            await $('.search-filters').collapse('hide');
            if (val == 'taxa') {
                await $('#taxa-filters').collapse('show');
            } else if (val == 'function') {
                await $('#function-filters').collapse('show');
            }
        },

        toggleDualVis: async function() {
            const dualVis = $("#dual-vis"); 
            if (dualVis.hasClass("row-cols-2")) {
                dualVis.removeClass("row-cols-2");
                dualVis.addClass("row-cols-1");
            } else {
                dualVis.removeClass("row-cols-1");
                dualVis.addClass("row-cols-2");
            }
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

        toggleSubtrees: function(selector) {
            const action = $(selector).hasClass("show") ? "hide" : "show";
            $(selector).collapse(action);
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
    },
    filters : {
        filterBlank : function (value) {
            blank = [
                "OTHER",
                "",
                "NA"
            ]
            return blank.indexOf(value) > -1 ? value : "-";
        },
        toRounded : function(value) {
            return Math.round(+value);
        },
        toFixed : function (value, decimal=3) {
            return +(+value).toFixed(decimal);
        },
        getKeyByValue : function(value, object) {
            return Object.keys(object).find(key => object[key] === value);
        },
        getLen : function(domains, gene) {
            return domains.filter(d => d.gene == gene)[0].lenseq
        },
        signalp: function(sp, gram) {
            if(!!sp)
                return sp[gram] == 'OTHER' ? '-' : sp[gram]
            else
                return ''
        },
        trimTaxa: function(str) {
            return str.toString().slice(3);
        }
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
        const sliderStartValues = {
            'specificity': urlParams.specificity || .9,
            'coverage': urlParams.coverage || .9,
            'conservation': urlParams.conservation || .9,
            'minDist': urlParams.minDist || 1,
        };

        // Build sliders
        ["specificity", "coverage", "conservation"].forEach(id => {
                let slider = document.getElementById(id);
                noUiSlider.create(slider,
                    {
                        start: sliderStartValues[id],
                        connect: [true, false],
                        step: .01,
                        range: {
                            min: 0,
                            max: 1
                            }
                    });
                const sliderLabel = d3.select(`.${id} label`);
                slider = slider.noUiSlider;
                slider.on('update', () => {
                    const name = id.trim().replace(/^\w/, c => c.toUpperCase());
                    sliderLabel.html(name+': '+slider.get());
                })
        })
        let slider = document.getElementById("mindist");
        noUiSlider.create(slider,
            {
                start: sliderStartValues["minDist"],
                connect: [true, false],
                step: 1,
                range: {
                    min: 0,
                    max: 2
                    }
            });
        const sliderLabel = d3.select(`.mindist label`);
        slider = slider.noUiSlider;
        slider.on('update', () => {
            let name =  "Min relative distance";
            sliderLabel.html(`${name}: ${parseInt(slider.get())} gene(s)`);
        })

        const query = urlParams['query'];

        if (searchType && query)
            this.searchQuery(searchType, query, urlParams);

        const taxonomy = this.allItems.map(i => [i.lineage, i.value]);
        SeqSunburst(taxonomy, 600, 6, true, this.showAddButton)
            .draw(".sunburst-selector");
        document.addEventListener("click", () => {
            if (!d3.select(".clone").node())
                d3.selectAll("#add-button-container *").remove();
        })
    },
});
