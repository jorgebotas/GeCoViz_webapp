var API_BASE_URL = "/api"

var colors = [
    "#9c89b8",
    "#f0a6ca",
    "#b8bedd",
    "#6B9080",
    "#A4C3B2",
    "#CCE3DE"
];


function acceptCookies() {
    fetch("/accept_cookies/")
        .then(() => {
            cookie_directive_container.style.opacity = 0;
        })
        .catch(() => {});
}

function welcomeModal(action="show") {
    const modal = $("#welcome");
    if (modal.length)
        setTimeout(() => modal.modal(action), 20)
}

function dismissWelcome() {
    fetch("/accept_welcome/")
        .then(() => {
            welcomeModal("hide");
        })
        .catch(() => {});
}

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

function hideOgSelector(callback) {
    setTimeout(() => {
        $('#og-selector').modal('hide');
        if (callback)
            setTimeout(() => callback, 1000)
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

function showSeqExample() {
    sequence_search.value = "MQEESPVAVQGTFVTNPVRPPAEVATSDSAISLRQPRPQTGEERAETKDTSPEKLQERLEALQKHLEEQGAPLHFSIVHDAGRVLVEVTQRDSQKVLMRIPPEGVLQVGADGLPSLGKLLDRRY";
}

function sequenceNotFound(_) {
    hideSpinner(() => {
        setTimeout(() => {
            $('#alert-sequence').modal('show')
        }, 160);
    });
}

function geneNameNotFound(_) {
    hideSpinner(() => {
        setTimeout(() => {
            $('#alert-pname').modal('show')
        }, 160);
    });
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
        const root = { name: "All organisms", children: [] };
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
    
const sunBurstDepth = 4;
function arcVisible(d) {
  return d.y1 <= (sunBurstDepth + 1) && d.y0 >= 1 && d.x1 > d.x0;
}



var vueapp = new Vue({
    delimiters: ['[[', ']]'],
    el: '#GeCoVizApp',
    data: {
        show: "gecoviz",
        query: { name: undefined, desc: undefined },
        searchType: undefined,
        searchTypeChoices: undefined,
        suggestions: {
            query: [],
            ko: [],
        },
        sequenceSearchResults: [],
        geneNameSearchResults: [],
        maxSelected: 250,
        selectedTaxids: [],
        searchedTaxa: [],
        searchTimeout: {
            query: undefined,
            taxa: undefined,
            ko: undefined
        },
        allItems: [], 
        sunBurst: undefined,
        GeCoViz: undefined,
        contextData: {
            newick: "",
            context: [],
            habitat: [],
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
        },
        kos: d3.hierarchy(kos),
    },
    methods: {
        // HME PAGE
        showKO: function(ko) {
            ko._show = !ko._show;
            const kos = this.kos;
            this.kos = [];
            this.kos = kos;
        },

        findKO: function(ko) {
            ko.ancestors()
                .reverse()
                .slice(1)
                .forEach(d => {
                    if (!d._show)
                        this.showKO(d)
                })
            const selector = `${ko.parent.data.name}_${ko.data.name}`;
            setTimeout(() => {
                document.getElementById(selector).scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                    inline: "center",
                  });
            }, 100)
        },

        findSuggestedKO: function() {
            if (!this.uniqueKOSuggestions.length)
                return
            const suggested = this.uniqueKOSuggestions[0];
            this.findKO(suggested);
        },

        updateKOSuggestions: function() {
            if (this.searchTimeout.ko)
                clearTimeout(this.searchTimeout.ko);
           this.searchTimeout.ko = setTimeout(() => {
                const search = $("#ko-search").val();

                if (search.length < 3) {
                    this.suggestions.ko = [];
                    return
                }


               this.suggestions.ko = this.kos.leaves()
                    .filter(d => 
                        d.data.name.includes(search) 
                        || d.data.desc.includes(search));
            }, 500);
        },

        // UI helpers
        showTab: function(selector) {
            const otherSelector = selector === "sunburst" ? "gecoviz" : "sunburst";
            const toRemove = $(`#${otherSelector}-navlink`);
            const toAdd = $(`#${selector}-navlink`);
            setTimeout(() => {
                toRemove.removeClass("active");
                toAdd.addClass("active");
            }, 100)
            this.show = selector;
        },

        showTaxaPopup: function(d) {
            function getParent(n, stop, count=0) {
                if (count >= stop)
                    return n
                const parent = n.parent
                if (!parent)
                    return n
                return getParent(parent, stop, count + 1)
            }
            const show = (n) => {
                this.sunBurst.highlightPath(n);
                this.showSunburstPopup(undefined, n);
            }

            if (arcVisible(d))
                show(d);
            else {
                setTimeout(() => this.sunBurst.update(getParent(d, sunBurstDepth)), 100);
                setTimeout(() => show(d), 1200);
            };
        },

        showSunburstPopup: function(event, d) {
            const target = event ? event.target :
                d3.select(`.${d.data.lineage.replaceAll(";", "--")
                                .replaceAll("(", "")
                                .replaceAll(")", "")
                                .replaceAll("=", "")
                                .replaceAll(":", "")
                                .replaceAll("/", "-")
                                .replaceAll(" ", "")}`)
                  .node();
            const createPopper = () => {
                const popper = d3.select(popperContainer)
                    .append('div')
                    .attr('class', 'popper')
                    .attr('role', 'tooltip')
                    .style('width', 'auto')
                    .style("border-color", "lightgray");
                // popper content
                const popperContent = popper.append('ul')
                    .attr('class', 'popper-content text-align-left m-0')
                    .style("padding", "0 5px 5px 5xp")
                    .style("overflow", "visible");

                popperContent
                    .append("li")
                    .attr("class", "dropdown-header f-bold")
                    .html(`${d.data.rank} <i class="color-tomato">${d.data.tname}</i>`)

                popperContent
                    .append("li")
                    .attr("class", "dropdown-item f-bold bg-indigo-lt")
                    .on("click", () => this.sunBurst.update(d))
                    .text("Zoom into taxa");

                popperContent
                    .append("li")
                    .attr("class", "dropdown-divider mb-1");

                const ranks = Object.keys(this.taxBadgeColors);
                if (ranks.indexOf(d.data.rank) >= ranks.indexOf("genus")
                    && d.children) {
                    const li = popperContent
                        .append("li")
                        .attr("class", "dropdown-item dropdown-submenu dropend");
                    li.append("a")
                        .attr("class", "dropdown-toggle no-after")
                        .attr("href", "#")
                        .attr("data-toggle", "dropdown")
                        .html("Choose <b class='f-bold'>specific genome</b>")
                        .append("i")
                            .attr("class", "fas fa-angle-right ml-2");
                    const submenu = li.append("ul")
                        .attr("class", "dropdown-menu popper-content")
                        .style("width", "auto")
                        .style("height", "auto")
                        .style("max-height", "400px");
                    d.leaves()
                     .sort((a,b) => ranks.indexOf(b.data.rank) < ranks.indexOf(a.data.rank))
                     .forEach(l => {
                        const color = this.taxBadgeColors[l.data.rank];
                        submenu.append("li")
                            .attr("class", "dropdown-item")
                            .on("click", () => this.selectTaxa(l, l.data.rank))
                            .html(`Add <span class="mx-1 badge f-bold ${color}">${l.data.rank}</span>`+
                                `<b class='mx-1 f-bold f-oblique'>${l.data.tname}</b>`);
                    })
                }
                
                popperContent
                    .append("li")
                    .attr("class", "dropdown-item")
                    .on("click", () => this.selectTaxa(d, d.data.rank))
                    .html("Add <b class='mx-1 f-bold'>1 genome</b> (random)");

                const genomes = this.allItems.filter(it => it.lineage.includes(d.data.lineage));
                const nHits = genomes.reduce((total, it) => total = total + it.value, 0);

                popperContent
                    .append("li")
                    .attr("class", () => "dropdown-item" 
                        + (nHits + this.nSelected > this.maxSelected ? " disabled" : ""))
                    .on("click", () => this.selectTaxa(d, "", true))
                    .html(`Add <b class="mx-1 f-bold"> all ${genomes.length} genomes</b> (${nHits} genes)`);


                if (!d.descendantRanks)
                    d.descendantRanks = this.getDescendantRanks(d);

                Object.entries(d.descendantRanks).forEach(([rank, lineages]) => {
                    const disabled = lineages.length + this.nSelected > this.maxSelected ||
                        this.getNumberOfRandomHits(lineages) + this.nSelected > this.maxSelected;
                    popperContent
                        .append("li")
                        .attr("class", () => "dropdown-item" + (disabled ? " disabled" : ""))
                        .on("click", () => this.selectLineages(lineages, d, rank))
                        .html(`Add representative genomes from <b class="mx-1 f-bold">${lineages.length} ${rank}</b>`)
                });

                // popper arrow
                popper.append('div')
                    .attr('class', 'popper-arrow')
                    .attr('data-popper-arrow', '')
                    .style("border-color", "transparent transparent lightgray lightgray");

                const popperNode = popper.node();

                Popper.createPopper(target, popperNode, {
                      placement: 'right',
                      modifiers: [
                        {
                          name: 'offset',
                          options: {
                            offset: [0, 5],
                          },
                        },
                        {
                          name: 'flip',
                          options: {
                              fallbackPlacements: ['left'],
                          }
                        }
                      ],
                    });
                popperNode.setAttribute('data-show', '');
            };

            setTimeout(createPopper, 10);
        },

        scrollToTop: function() {
            $("html, body").animate({ scrollTop: 0 }, "slow");
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

        copyUrl: function() {
            if (navigator.clipboard) {
                navigator.clipboard.writeText(window.location.href);
            }
         },

        // Server interaction
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

        fetchThen : function(data, _hideSpinner=true) {
            this.allItems = data.matches;
            this.root =  buildTaxaHierarchy(this.allItems
                .map(i => [i.lineage, i.id, i.value]))
            this.root.each(d => {
                const [ rank, tname ] = d.data.name.split("__");
                d.data.rank = rank;
                d.data.tname = tname || d.data.id;
                d.data.lineage = getLineage(d);
            });

            if (this.allItems.length == 0) {
                fetchCatch();
                return;
            }

            setTimeout(() => {
                this.toggleSunburstSelector();
                this.updateSearch();
                //if (_hideSpinner)
                    //hideSpinner();

                const sharedTaxa = this.getSharedTaxa(this.root);
                sharedTaxa.descendantRanks = this.getDescendantRanks(sharedTaxa);

                this.sunBurst.update(sharedTaxa.parent || this.root);

                if (this.selectedTaxids.length
                    && this.selectedTaxids.length < this.maxSelected)
                    this.selectedTaxids.forEach(t => { t.source = sharedTaxa});
                else {
                    const maxSelected = 100;
                    if (this.allItems.length <= maxSelected)
                        this.selectTaxa(sharedTaxa, "species", true);
                    else {
                        const ranks = ["genus", "family", "phylum", "clade", "superkingdom"];
                        const filteredRanks = ranks.filter(rank => {
                            const descendantRanks = sharedTaxa.descendantRanks[rank];
                            // Simulate selecting random genomes from descendantRanks
                            return descendantRanks && descendantRanks.length <= maxSelected
                                && this.getNumberOfRandomHits(descendantRanks) <= maxSelected;
                        });
                        if (filteredRanks.length)
                            this.selectLineages(sharedTaxa.descendantRanks[filteredRanks[0]],
                                sharedTaxa, filteredRanks[0]);
                    }
                }
                this.visualizeSelection(true);
            }, 0)
        },

        searchOgsBySequence: async function() {

            const sequence = sequence_search.value.trim();

            if (!sequence)
                alert("Please copy and paste sequence of interest")

            $('#spinner').modal('show');

            fetch(API_BASE_URL + "/ogs_from_seq/", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sequence: sequence })
            }).then(res => res.json())
              .then(data => {
                  this.sequenceSearchResults = data.matches;
                  if (data.matches.length === 0)
                      sequenceNotFound();
                  else
                      hideSpinner();
            }).catch(sequenceNotFound)
        },

        searchOgsByGeneName: async function(query, _hideSpinner) {
            await fetch(API_BASE_URL + `/ogs_from_pname/${query}/`)
                 .then(response => response.json())
                 .then(data => {
                      this.geneNameSearchResults = data.matches;
                      if (data.matches.length === 0)
                          geneNameNotFound();
                      else {
                          $("#og-selector").modal("show")
                          hideSpinner();
                      }
                  }).catch(geneNameNotFound)
        },

        searchQuery : async function(searchType, query, _hideSpinner) {
            $('#spinner').modal('show');
            const newQuery = query || $("#query-search").val().trim();
            this.searchType = searchType || this.searchTypeChoices.getValue(true);
            if (newQuery) {
                this.allItems = [];
                this.sequenceSearchResults = [];
                if (this.searchType !== "pname")
                    hideOgSelector(() => this.geneNameSearchResults = []);
                else
                    this.geneNameSearchResults = [];
                this.root = undefined;
                this.selectedTaxids = [];
                this.searchedTaxa = [];
                this.contextData.context = [];
                this.query.name = newQuery.replace("ENOG50", "");
                d3.selectAll(".sunburst-selector *").remove();
            }
            $("#query-search").val(this.query.name);
            this.searchTypeChoices.setChoiceByValue(this.searchType);

            if (["ogs", "kos"].includes(this.searchType)) {
                this.query.name = this.query.name.toUpperCase();
                if (this.searchType === "ogs" &&
                    this.query.name.slice(0,2) === "AR")
                    this.query.name = `ar${this.query.name.slice(2)}`
            }

            const params = {
                query: this.query.name,
                searchType: this.searchType,
            }
            this.updateSearchParams(params);

            $('#query-search').trigger('blur');

            if (this.searchType === "pname") {
                this.searchOgsByGeneName(this.query.name, _hideSpinner);
                return
            };

            await fetch(API_BASE_URL + `/description/${this.searchType}/${this.query.name}/`)
                 .then(response => response.json())
                 .then(data => this.query.description = data.description)
                 .catch(() => {});

            await fetch(API_BASE_URL + `/emapper/${this.searchType}/${this.query.name}/`)
                 .then(response => response.json())
                 .then(data => this.fetchThen(data, _hideSpinner))
                 .catch(fetchCatch);
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

            function getHabitat(contextData) {
                const anchors = contextData.filter(c => c.pos == 0);
                return anchors.reduce((t, a) => {
                    for (const h of a["isolation source"]) {
                        t.push({ anchor: a.anchor, "isolation source": h.id, value: 1 });
                    }
                    return t;
                }, []);
            }

            const taxids = this.selectedTaxids.map(t => t.id).join(",");
            const endpoint = `${this.searchType}/${this.query.name}/${taxids}/`;

            this.contextData.context = [];
            this.contextData.newick = await getNewick(endpoint);
            this.contextData.context = await getContext(endpoint);
            this.contextData.habitat = await getHabitat(this.contextData.context);
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
                "KEGG Orthology", "eggNOG Orthology"];
            const tsv = this.contextData.context.map(g => {
                return fields.map(f => {
                    const info = g[f];
                    return typeof info === "object" ? info.map(i => i.id) : info;
                }).join("\t")
            });

            const headedTsv = [ fields.join("\t"), ...tsv ].join("\n");

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

        // Getters
        getNumberOfHits: function(selectedTaxids, lineage) {
            return this.allItems.reduce((total, i) => {
                if ((selectedTaxids || []).includes(+i.id) ||
                    (lineage && i.lineage.includes(lineage)) ||
                    (lineage === ""))
                    total += i.value;
                return total
            }, 0)
        },

        getNumberOfRandomHits: function(lineages) {
            // Get number of random hits within each of the lineages
            const matches = this.root.leaves()
                    .filter(d => lineages.some(lineage => d.data.lineage.includes(lineage)));
            return lineages.reduce((total, _) => {
                const randomHit = matches[Math.floor(Math.random()*matches.length)].data.value;
                total += randomHit
                return total
            }, 0);
        },

        getSharedTaxa: function(root) {
            function getShared(node) {
                if (node.children.length > 1)
                    return node
                return getShared(node.children[0])
            };
            const shared = getShared(root);
            return shared;
        },

        getDescendantRanks: function(d) {
            const levels = d.descendants().slice(1).reduce((ranks, d) => {
                const rank = d.data.name.split("__")[0];
                ranks[rank] = ranks[rank] || [];
                const lineage = getLineage(d);
                ranks[rank].push(lineage);
                return ranks
            }, {})

            return levels
        },

        // Suggestions
        updateSuggestions: function() {
            if (this.searchTimeout.query)
                clearTimeout(this.searchTimeout.query);
           this.searchTimeout.query = setTimeout(() => {
                this.searchType = this.searchTypeChoices.getValue(true);
                const search = $("#query-search").val().replace("ENOG50", "");

                if (search.length < 3) {
                    this.suggestions.query = [];
                    return
                }
                
                fetch(`${API_BASE_URL}/suggestions/${this.searchType}/${search}/`)
                    .then(response => response.json())
                    .then(data => {
                        this.suggestions.query = data.suggestions;
                    })
                    .catch(() => {
                        this.suggestions.query = [];
                    });
                
            }, 500);
        },

        updateSearch: function() {
            if (this.searchTimeout.taxa)
                clearTimeout(this.searchTimeout.taxa);
            this.searchTimeout.taxa = setTimeout(() => {
                const search = $("#taxa-search").val().trim().toLowerCase();

                if (search.length < 3) {
                    this.searchedTaxa = [];
                    return
                }

                this.searchedTaxa = this.allTaxa.filter(d =>
                    d.data.name.toLowerCase().includes(search))
            }, 500);
        },

        // Selectors
        selectTaxid: function(id, source, rank, show) {
            const isSelected = this.selectedTaxids.find(t => t.id === id);
            show = show || !isSelected;
            if (isSelected) {
                if (!show)
                    this.selectedTaxids = this.selectedTaxids.filter(
                        t => t.id != id);
            } else if (show) {
                this.selectedTaxids.push({ id: id, source: source, rank: rank || "species" });
            }
        },

        selectLineage: function(lineage, taxa, rank, allDescendants=false) {
            const matches = this.root.leaves()
                    .filter(d => d.data.lineage.includes(lineage));
            if (allDescendants)
                matches.forEach(d => this.selectTaxid(d.data.id, taxa, "species", true))
            else {
                const taxid = matches[Math.floor(Math.random()*matches.length)].data.id;
                this.selectTaxid(taxid, taxa, rank || taxa.data.rank, true);
           }
        },

        selectLineages: function(lineages, taxa, rank) {
            this.deselectTaxa(taxa);
            lineages.forEach(l => this.selectLineage(l, taxa, rank));
        },

        selectTaxa: function(taxa, rank, allDescendants=false) {
            this.sunBurst.highlightPath(taxa);

            if (!taxa.data.descendantRanks)
                taxa.descendantRanks = this.getDescendantRanks(taxa);
            
            const lineage = taxa.data.lineage;
            this.deselectTaxa(taxa);
            this.selectLineage(lineage, taxa, rank || taxa.data.rank, allDescendants);
        },

        deselectTaxa: function(taxa) {
            this.selectedTaxids = this.selectedTaxids.filter(t => t.source != taxa);
        },

        deselectAll: function() {
            this.selectedTaxids = [];
            this.updateSearch();
        },

        // Sunburst and GeCoViz
        toggleSunburstSelector: function() {
            this.showTab("sunburst");
            // Do not toggle if now query has been processed
            if (this.allItems.length == 0)
                this.searchQuery();

            if (d3.selectAll(".sunburst-selector *").nodes().length) {
                setTimeout(() => {
                    $("#taxa-search").focus()
                    console.log("hi")
                }, 1000);
                return
            }
            const taxonomy = this.allItems.map(d => [d.lineage, d.value]);
            this.sunBurst = SeqSunburst(taxonomy, 600, sunBurstDepth, false, this.showSunburstPopup, this.root)
                .draw(".sunburst-selector");
        },

        async visualizeSelection(refresh=true) {
            const content = d3.selectAll("#gecoviz-container *").nodes();
            if (content.length && !refresh)
                this.showTab("gecoviz");
            else
                await this.toggleGeCoViz();
        },

        toggleGeCoViz : async function() {
            this.showTab("gecoviz");

            const selector = "#gecoviz-container";

            const content = d3.selectAll("#gecoviz-container *");
            if (content.nodes().length)
                content.remove();

            $('#spinner').modal('show');
            const params = {
                query: this.query.name,
                searchType: this.searchType,
                taxids: this.selectedTaxids.map(t => t.id).join(",")
            }

            this.updateSearchParams(params);

            // Fetch context data
            await this.searchContext();

            const { newick, context, habitat } = this.contextData;

            const newickFields = [
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
            const habitatColors = {
                "soil": "#E48825",                  // orange
                "aquatic": "#6272BC",               // blue
                "aquatic_freshwater": "#13D5CC",    // turquoise
                "aquatic_sediment_mud": "#8E663E",  // brown
                "host_associated": "#9A4DA8",       // purple (red: EF6B6B)
                "host_plant_associated": "#7BB77B", // green
                "food_associated": "#FCC065",       // yellow
                "disease_associated": "#C80414"     // red
            }

            this.GeCoViz = await GeCoViz(selector)
                .treeData(newick, newickFields[1], newickFields)
                .contextData(context)
                .heatmapData(habitat, { x: "isolation source", y: "anchor" }, habitatColors, "Isolation source")
                .nSide(4, 4)
                .scaleDist()
                .zoom(0.3)
                .viewPort(document.querySelector(selector))
                .geneText("Gene name")
                .annotation("eggNOG Orthology", 2)
                .options({ shrinkTreeWidth: true, onlyViewport: false })
                .draw();

            setTimeout(hideSpinner, 10);
            setTimeout(this.GeCoViz.scaleDist, 1000);
        },

        getOutputFilename: function() {
            const fileName = `${this.query.name}_${this.nAnchors}g_${this.selectedTaxids.length}sp`
                + (this.sharedTaxa ? `-${this.sharedTaxa}` : "");
            return fileName
        },

        downloadContextHtml: function() {
            const fileName = this.getOutputFilename();
            this.GeCoViz.toHtml(fileName);
        },

        downloadContextPdf: async function() {
            const fileName = this.getOutputFilename();
            
            $('#spinner').modal('show');
            setTimeout(() => this.GeCoViz.toPdf(fileName), 500);
            hideSpinner();
        },
    },
    computed: {
        isScreenLarge: function() {
            return +window.innerWidth >= 1680;
        },

        uniqueKOSuggestions: function() {
               const uniqueSuggestions = this.suggestions.ko.reduce((t, d) => {
                   t[d.data.name] = d
                   return t
               }, {});
            return [...Object.values(uniqueSuggestions)]
        },

        nMatches : function() {
            return this.allItems.reduce((total, i) => total + i.value, 0);
        },

        nSelected : function() {
            const selectedTaxids = this.selectedTaxids.map(d => d.id);
            return this.getNumberOfHits(selectedTaxids);
        },

        nAnchors: function() {
            if (!this.contextData.context)
                return 0
            return this.contextData.context.filter(c => c.pos == 0).length
        },

        allTaxa: function() {
            return this.root.descendants().slice(1);
        },

        selectedTaxa: function() {
            return Object.values(this.selectedTaxids.reduce( (selected, t) => {
                const source = t.source || { data: { tname: t.id, lineage: t.id } };
                const lineage = source.data.lineage;
                selected[lineage] = selected[lineage] 
                    || { source: source, rank: t.rank, taxids: [] };
                selected[lineage].taxids.push(t.id);
                return selected
            }, {}))
        },

        sharedTaxa: function() {
            const shared = this.selectedTaxa.reduce((t, it, i) => {
                const itSplit = it.source.data.lineage.split(";");
                if (i === 0)
                    t =  itSplit
                else
                    t = t.filter((d, i) => d === itSplit[i]);
                return t
            }, []);
            return shared[shared.length-1] || ""
        },
    },
    filters : {
        styleTaxa: function(taxa) {
            if (!taxa) return 
            const [ rank, t ] = taxa.split("__");
            return `${rank} ${t}`;
        }
    },
    mounted: async function() {

        document.addEventListener("click", () => {
            d3.selectAll("#popperContainer .popper").remove();
        });

        ["query", "taxa", "ko"].forEach(d => {
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
                    label: 'eggNOGv5 Orthologous Group (COG/ENOG)',
                    selected: this.searchType == 'ogs' 
                },
                {
                    value: 'kos', 
                    label: 'KEGG Orthologous Group (KO)',
                    selected: this.searchType == 'kos' 
                },
                {
                    value: 'pname', 
                    label: 'Gene name',
                    selected: this.searchType == 'pname' 
                },
                {
                    value: 'pfam', 
                    label: 'PFAM domain',
                    selected: this.searchType == 'pfam'
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
            this.query.name = query.replace("ENOG50", "");
            this.searchType = searchType;
            
            $("#query-search").val(this.query.name);
            this.searchTypeChoices.setChoiceByValue(this.searchType);
            //d3.select(`#search-type inpu.split("%2C")t[value="${this.searchType}"]`)
                //.attr("checked", true);

            await this.searchQuery(searchType, query, !(taxids && taxids.length));

            if (taxids && taxids.length) {
                this.root.descendantRanks = this.getDescendantRanks(this.root);
                this.selectedTaxids = taxids.split("%2C").map(t => { 
                    return { id: +t, source: this.root, rank: "species" }
                });
            }
        }
    },
});
