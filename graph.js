function ForceGraph({
    nodes, // an iterable of node objects (typically [{id}, …])
    links // an iterable of link objects (typically [{source, target}, …])
}, {
    nodeId = d => d.id, // given d in nodes, returns a unique identifier (string)
    nodeGroup, // given d in nodes, returns an (ordinal) value for color
    nodeGroups, // an array of ordinal values representing the node groups
    nodeGeolocation, // given d in nodes, return d.location as string
    nodeTitle, // given d in nodes, a title string
    nodeFill = "currentColor", // node stroke fill (if not using a group color encoding)
    nodeStroke = "#fff", // node stroke color
    nodeStrokeWidth = 1.5, // node stroke width, in pixels
    nodeStrokeOpacity = 1, // node stroke opacity
    nodeRadius = 5, // node radius, in pixels
    nodeStrength,
    linkSource = ({ source }) => source, // given d in links, returns a node identifier string
    linkTarget = ({ target }) => target, // given d in links, returns a node identifier string
    linkStroke = "#999", // link stroke color
    linkStrokeOpacity = 0.6, // link stroke opacity
    linkStrokeWidth = 1.5, // given d in links, returns a stroke width in pixels
    linkStrokeLinecap = "round", // link stroke linecap
    linkStrength,
    colors = d3.schemeTableau10, // an array of color strings, for the node groups
    width = 640, // outer width, in pixels
    height = 400, // outer height, in pixels
    invalidation // when this promise resolves, stop the simulation
} = {}) {
    // Compute values.
    const N = d3.map(nodes, nodeId).map(intern)
    const R = typeof nodeRadius !== "function" ? null : d3.map(nodes, nodeRadius);
    const LS = d3.map(links, linkSource).map(intern);
    const LT = d3.map(links, linkTarget).map(intern);
    if (nodeTitle === undefined) nodeTitle = (_, i) => N[i];
    const T = nodeTitle == null ? null : d3.map(nodes, nodeTitle);
    const G = nodeGroup == null ? null : d3.map(nodes, nodeGroup).map(intern);
    const W = typeof linkStrokeWidth !== "function" ? null : d3.map(links, linkStrokeWidth);
    const L = typeof linkStroke !== "function" ? null : d3.map(links, linkStroke);
    const LOC = nodeGeolocation == null ? null : d3.map(nodes, nodeGeolocation);

    console.log("nodes", LOC);

    // Replace the input nodes and links with mutable objects for the simulation.
    nodes = d3.map(nodes, (_, i) => ({ id: N[i], group: G && G[i], location: LOC && LOC[i] }));
    links = d3.map(links, (_, i) => ({ source: LS[i], target: LT[i] }));

    // Compute default domains.
    if (G && nodeGroups === undefined) nodeGroups = d3.sort(G);

    // Construct the scales.
    const color = nodeGroup == null ? null : d3.scaleOrdinal(nodeGroups, colors);

    // Construct the forces.
    const forceNode = d3.forceManyBody();
    const forceLink = d3.forceLink(links).id(({ index: i }) => N[i]);
    if (nodeStrength !== undefined) forceNode.strength(nodeStrength);
    if (linkStrength !== undefined) forceLink.strength(linkStrength);

    const simulation = d3.forceSimulation(nodes)
        .force("link", forceLink)
        .force("charge", forceNode)
        .force("center", d3.forceCenter())
        .on("tick", ticked);

    const svg = d3.create("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [-width / 2, -height / 2, width, height])
        .attr("style", "max-width: 100%; height: auto; height: intrinsic;")
        .call(d3.zoom().on("zoom", function (event) {
            container.attr("transform", event.transform);
        }));

    const container = svg.append("g");

    const link = container.append("g")
        .attr("stroke", typeof linkStroke !== "function" ? linkStroke : null)
        .attr("stroke-opacity", linkStrokeOpacity)
        .attr("stroke-width", typeof linkStrokeWidth !== "function" ? linkStrokeWidth : null)
        .attr("stroke-linecap", linkStrokeLinecap)
        .selectAll("line")
        .data(links)
        .join("line");

    const node = container.append("g")
        .attr("fill", nodeFill)
        .attr("stroke", nodeStroke)
        .attr("stroke-opacity", nodeStrokeOpacity)
        .attr("stroke-width", nodeStrokeWidth)
        .selectAll("circle")
        .data(nodes)
        .join("circle")
        .attr("r", nodeRadius)
        .call(drag(simulation))
        .on("mouseover", add_tooltip)
        .on("mouseout", remove_tooltip)
        .on("click", persist_tooltip);

    if (W) link.attr("stroke-width", ({ index: i }) => W[i]);
    if (L) link.attr("stroke", ({ index: i }) => L[i]);
    if (G) node.attr("fill", ({ index: i }) => color(G[i]));
    if (R) node.attr("r", ({ index: i }) => R[i]);
    if (T) node.append("title").text(({ index: i }) => T[i]);
    if (invalidation != null) invalidation.then(() => simulation.stop());

    function intern(value) {
        return value !== null && typeof value === "object" ? value.valueOf() : value;
    }

    function ticked() {
        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        node
            .attr("cx", d => d.x)
            .attr("cy", d => d.y);
    }

    function drag(simulation) {
        function dragstarted(event) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
        }

        function dragged(event) {
            event.subject.fx = event.x;
            event.subject.fy = event.y;
        }

        function dragended(event) {
            if (!event.active) simulation.alphaTarget(0);
            event.subject.fx = null;
            event.subject.fy = null;
        }

        return d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended);
    }

    const tooltip = svg.append('g')
        .attr('class', 'tooltip')
        .attr('transform', `translate(${width / 4}, -${height / 2})`)

    tooltip.append('rect')
        .attr('width', 150)
        .attr('height', 70)
        .attr('fill', 'white')
        .attr('stroke', '#333')

    function add_tooltip(event, d) {
        console.log("Node clicked:", d); // Log the details of the clicked node to the console
        tooltip.append('text')
            .attr('x', 5)
            .attr('y', 20)
            .text(`ID: ${d.id}`)
        tooltip.append('text')
            .attr('x', 5)
            .attr('y', 40)
            .text(`Group: ${d.group}`)
        tooltip.append('text')
            .attr('x', 5)
            .attr('y', 60)
            .text(`Location: ${d.location}`)
        console.log(tooltip)
    }

    function persist_tooltip(event, d) {
        add_tooltip(event, d)
        // make sure mouseout doesn't remove the tooltip
        tooltip.on('mouseout', () => {})
    }

    function remove_tooltip(event, d) {
        tooltip.selectAll('text').remove()
    }

    return Object.assign(svg.node(), { scales: { color } });
}

d3.json("./bollywood.json").then(function (jsonData) {
    console.log("JSON data fetched:", jsonData);
    // Create D3.js chart with fetched JSON data
    const chart = ForceGraph(jsonData, {
        nodeId: d => d.id,
        nodeGroup: d => d.group,
        nodeGeolocation: d => d.location,
        nodeTitle: d => `${d.id}\n${d.group}`,
        linkStrokeWidth: l => Math.sqrt(l.weight),
    });

    // Select the chart container and append the chart to it
    d3.select("#chart").append(() => chart);

}).catch(function (error) {
    // Handle errors if any
    console.error("Error fetching JSON data:", error);
});


