// Input is a list of sequence-count tuples
// Sequence: separated by ';'
// count: int

var SeqSunburst = function(unformattedData, width, depth=2,
    semiCircle=false, clickCallBack) {

    var container;
    var removeClones = false;
    const maxAngle = (semiCircle ? 1 : 2) * Math.PI;
    const graph = function () { return this; };
    // Converts data to hierarchical format
    const separator = ";";
    function buildRoot(data) {
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
                .size([maxAngle, root.height + 1])
              (root);
        }

        const hierarchy = buildHierarchy(data);
        return partition(hierarchy);
    }

    const radius = width / ((depth + 1) * 2)
    // Arc function
    const arc = d3.arc()
      .startAngle(d => d.x0)
      .endAngle(d => d.x1)
      .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005))
      .padRadius(radius * 1.5)
      .innerRadius(d => d.y0 * radius)
      .outerRadius(d => Math.max(d.y0 * radius, d.y1 * radius - 1))

    // Value formatter
    const format = d3.format(",d")

    const data = buildRoot(unformattedData);

    data.each(d => d.current = d);

    const root = data;
    let oldRootSequence = [];
    let rootSequence = [];

    function getFirstSplit(d) {
        const length = d.children.length;
        if (length > 1)
            return length
        if (length == 1)
            return getFirstSplit(d.children[0])
        else
            return 0
    }

    const colors = [
        "#82a8c4",
        "#99c1de",
        "#bcd4e6",
        "#acc8c1",
        "#bedad9",
        "#d7eae4",
        "#fad2e1",
        "#fde2e4",
        "#eddcd2",
        "#fff1e6"
    ];

    function buildFields() {
        unfFields = []
        unformattedData.forEach(d => {
            const seq = d[0].split(separator)
            unfFields.push(...seq)
        })
        return [...new Set(unfFields)];
    }
    const fields = buildFields();
    const palette = d3.scaleOrdinal()
      .domain(fields)
      .range(colors);
    //const palette = d3.scaleOrdinal(d3.quantize(d3.interpolateRainbow,
        //getFirstSplit(data) + 1));

    function buildSunburst() {

        const svg = container.append("svg")
            .attr("viewBox", `${semiCircle ? 0 : -width/2} ${-width/2} ${width} ${width}`)
            .style("max-width", `${width}px`)
            .attr("class", "seq-sunburst")
            .style("font", "10px sans-serif");

        const g = svg.append("g");

        const label = g
            .append("text")
            .attr("text-anchor", "middle")
            .attr("fill", "#888")
        label
            .append("tspan")
            .attr("class", "value")
            .attr("x", 0)
            .attr("y", 0)
            .attr("dx", () => semiCircle ? "0.5em" : 0)
            .attr("dy", "0.3em")
            .attr("font-size", "20px")
            .text("");

        function mouseEnter(_, d) {
            if (!arcVisible(d.current))
                return
            // Get the ancestors of the current segment, minus the root
            const sequence = getSequence(d);
            // Highlight the ancestors
            path.attr("fill-opacity", node => arcVisible(node.current) ?
                (sequence.indexOf(node) >= 0 ? 1 : 0.8) : 0)
                .attr("stroke-width", node => arcVisible(node.current) && 
                    sequence.indexOf(node) >= 0 ? "1.5px" : 0);
            //const percentage = ((100 * d.value) / root.value).toPrecision(3);
            label
                .style("visibility", null)
                .select(".value")
                .text(d.value);
            //Update breadcrumb
            breadcrumb.update(sequence)
            path.attr("fill-opacity", node => arcVisible(node.current) ?
                (sequence.indexOf(node) >= 0 ? 1 : 0.8) : 0);
        }

        const path = g.append("g")
          .selectAll("path")
          .data(root.descendants()) //.slice(1))
          .join("path")
            .attr('fill', d => palette(d.data.name))
            //.attr("fill", d => { while (d.depth > 1) d = d.parent; return palette(d.data.name); })
            .attr("fill-opacity", d => arcVisible(d.current) ? (d.children ? 0.8 : 0.8) : 0)
            .attr("stroke", "lightgray")
            .attr("stroke-width", 0)
            .attr("d", d => arc(d.current))
            .on("mouseenter", mouseEnter);
        path.on("mouseleave", () => {
                path.attr("fill-opacity", d => 
                    arcVisible(d.current) ? (d.children ? 0.8 : 0.6) : 0)
                    .attr("stroke-width", 0);
                label.style("visibility", "hidden");
                breadcrumb.update(rootSequence)
            })

        path.style("cursor", "pointer")
            .on("dblclick", (e, p) => {
                e.preventDefault();
                console.log(getSequence(p))
            });
        path.on("click", function(_, d) {
                const gClone = g.insert("g", ".text-labels")
                    .attr("class", "clone");
                const sequence = getSequence(d);
                if (clickCallBack) {
                    const sequenceString = sequence
                        .map(d => d.data.name).join(separator);
                    clickCallBack(sequenceString);
                }
                path.filter(d => sequence.slice(0, -1).indexOf(d) >= 0)
                    .each(function() {
                        const clone = d3.select(this.cloneNode(false))
                            .attr("fill-opacity", 1)
                            .style("stroke", "lightgray")
                            .style("stroke-width", "1.5px");
                        gClone.node().appendChild(clone.node());
                    })
                const clone = d3.select(this.cloneNode(true))
                            .attr("fill-opacity", 1)
                            .style("stroke", "lightgray")
                            .style("stroke-width", "1.5px");
                clone.on("click", () => {
                    setTimeout(() => {
                        if (d.children)
                            graph.update(d);
                        gClone.remove();
                    }, 10);
                });

                // Flags
                if (!g.select("g.clone").node())
                    oldRootSequence = rootSequence;
                rootSequence = sequence;
                removeClones = false;

                // Update removeClones flag and breadcrumb
                setTimeout(() => {
                    breadcrumb.update(rootSequence);
                    removeClones = true;
                }, 10);
                gClone.node().appendChild(clone.node());
            })

        d3.select(document).on("click", function() {
            if (g.select("g.clone").node()) {
                if (removeClones) {
                    g.selectAll("g.clone").remove();
                    rootSequence = oldRootSequence;
                    breadcrumb.update(rootSequence);
                } else
                    g.selectAll("g.clone").nodes().slice(0, -1)
                        .forEach(c => c.remove());
            }
        });

        path.append("title")
            .text(d => d.ancestors().map(d => d.data.name).reverse().join("/")
                + "\n" + format(d.value));


        //const textLabels = g.append("g")
            //.attr("class", "text-labels")
            //.attr("pointer-events", "none")
            //.attr("text-anchor", "middle")
            //.style("user-select", "none")
          //.selectAll("text")
          //.data(root.descendants().slice(1))
          //.join("text")
            //.attr("dy", "0.35em")
            //.attr("fill-opacity", d => +labelVisible(d.current))
            //.attr("transform", d => labelTransform(d.current))
            //.text(d => d.value);

        const parent = g.append("circle")
            .datum(root)
            .attr("r", radius)
            .attr("fill", "none")
            .attr("pointer-events", "all")
            .on("click", (_, d) => graph.update(d));

        graph.update = function(p) {
            parent.datum(p.parent || root);
            // Update root sequence
            rootSequence = oldRootSequence = getSequence(p);
            breadcrumb.update(rootSequence);

            root.each(d => d.target = {
              x0: Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) * maxAngle,
              x1: Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) * maxAngle,
              y0: Math.max(0, d.y0 - p.depth),
              y1: Math.max(0, d.y1 - p.depth)
            });

            const t = g.transition().duration(1000);

            // Transition the data on all arcs, even the ones that aren’t visible,
            // so that if this transition is interrupted, entering arcs will start
            // the next transition from the desired position.
            path.transition(t)
                .tween("data", d => {
                  const i = d3.interpolate(d.current, d.target);
                  return t => d.current = i(t);
                })
              .filter(function(d) {
                return +this.getAttribute("fill-opacity") || arcVisible(d.target);
              })
                .attr("fill-opacity", d => arcVisible(d.target) ? (d.children ? 0.6 : 0.4) : 0)
                .attrTween("d", d => () => arc(d.current));

            //textLabels.filter(function(d) {
                //return +this.getAttribute("fill-opacity") || labelVisible(d.target);
              //}).transition(t)
                //.attr("fill-opacity", d => +labelVisible(d.target))
                //.attrTween("transform", d => () => labelTransform(d.current));

            return graph;
        }

      }

    function getSequence(d) {
        return d.ancestors()
            .reverse()
            .slice(1);
    }
    
    function arcVisible(d) {
      return d.y1 <= (depth + 1) && d.y0 >= 1 && d.x1 > d.x0;
    }

    function labelVisible(d) {
      return d.y1 <= (depth + 1) && d.y0 >= 1 && (d.y1 - d.y0) * (d.x1 - d.x0) > 0.03;
    }

    function labelTransform(d) {
      const x = (d.x0 + d.x1) / 2 * 360 / maxAngle;
      const y = (d.y0 + d.y1) / 2 * radius;
      return `rotate(${x - 90}) translate(${y},0) rotate(${90 - x})`;
    }

    graph.draw = function(selector) {
        container = d3.select(selector);
        container
            .append('div')
            .attr('class', 'breadcrumb-container')
            .style('width', '100%')
            .style('justify-content', () => semiCircle ? 'start' : 'center')
            .style('display', 'flex')
            .style('margin-top', '20px')
        container = container
            .insert('div', '.breadcrumb-container')
            .attr('class', 'SeqSunburst-container')
            .style('width', '100%')
            .style('display', 'flex')
            .style('justify-content', () => semiCircle ? 'start' : 'center');
        breadcrumb = new BreadCrumb(selector + ' .breadcrumb-container',
            palette,
            {
                'd': 'domain',
                'p': 'phylum',
                'c': 'class',
                'o': 'order',
                'f': 'family',
                'g': 'genus',
                's': 'species'
            }, [], graph);
        buildSunburst();
        return graph;
    }

    return graph;
}

var capitalize = function(string) {
    return string.trim().replace(/^\w/, c => c.toUpperCase());
}

class BreadCrumb {
    constructor(selector, palette, fields, seq, sunburst, options = { showFields: true }) {
        // Polygon dimensions
        this.polygonWidth = 120;
        this.polygonHeight = 30;
        this.polygonPadding = 2;
        this.tipWidth = 10;
        this.fieldsHeight = options.showFields ? 17 : 0;
        this.palette = palette;
        this.seq;
        this.fields = fields;
        this.maxSeqLength = Object.keys(this.fields).length;
        this.sunburst = sunburst;
        this.container = d3.select(selector)
            .append('svg')
            .attr('class', 'BreadCrumb')
            .style('overflow', 'visible')
            .attr('width',
                this.maxSeqLength*this.polygonWidth
                + this.tipWidth
                + this.polygonPadding)
            .attr('height', this.polygonHeight + this.fieldsHeight);
        if (seq)
            this.update(seq)
    }

    // Generate a string that describes the points of a breadcrumb SVG polygon
    breadcrumbPoints(i) {
        //const x0 = this.polygonWidth * i + this.polygonPadding;
        //const x = this.polygonWidth * (i+1);
        const x0 = this.polygonPadding;
        const x = this.polygonWidth;
        const y0 = this.fieldsHeight;
        const y = y0 + this.polygonHeight;
        const points = [];
        points.push(`${x0}, ${y0}`);
        points.push(`${x}, ${y0}`);
        points.push(`${x + this.tipWidth}, ${y0 + this.polygonHeight / 2}`);
        points.push(`${x},${y }`);
        points.push(`${x0},${y}`);
        if (i > 0) {
            // Leftmost breadcrumb; don't include 6th vertex.
            points.push(`${x0 + this.tipWidth},${y0 + this.polygonHeight / 2}`);
        }
        return points.join(" ");
    }

    updatePolygons() {
        const breadcrumbs = this.container
            .selectAll('.breadcrumb-g')
            .data(this.seq, d => d.data.name);
        const breadcrumbsEnter = breadcrumbs
            .enter()
            .append('g')
            .attr('class', 'breadcrumb-g')
            .style('cursor', 'pointer')
            .style('text-align', 'center')
            .attr('transform', (_, i) =>
                `translate(${this.polygonWidth*i}, 0)`);
        // Polygon
        breadcrumbsEnter
            .append('polygon')
            .attr('class', 'breadcrumb-polygon')
            .attr('fill', d => this.palette(d.data.name))
            .attr('points', (_, i) => this.breadcrumbPoints(i));
        // Text on polygon
        breadcrumbsEnter
            .append('text')
            .attr('class', 'breadcrumb-polygon-text')
            .text(d => d.data.name.slice(3))
            .attr('x', this.tipWidth + this.polygonWidth/2)
            .attr('y', this.fieldsHeight + this.polygonHeight/1.5)
            .style('text-anchor', 'middle')
            .style('font-size', '9px')
            .style('font-weight', 'bold');
        // Text on top
        breadcrumbsEnter
            .append('text')
            .attr('class', 'breadcrumb-top-text')
            .text(d => capitalize(this.fields[d.data.name.slice(0, 1)]))
            .attr('x', this.tipWidth + this.polygonWidth/2)
            .attr('y', this.fieldsHeight - 5)
            .style('text-anchor', 'middle')
            .style('font-size', '9px')
            .style('font-weight', 'bold');

        breadcrumbsEnter
            .on("click", (_, d) => {
                if (d.children)
                    this.sunburst.update(d)
            });
        // Exit breadcrumbs
        breadcrumbs
            .exit()
            .remove();
    }

    update(seq) {
        this.seq = seq;
        this.updatePolygons();
    }
}
