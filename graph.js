
function ForceGraph({
    nodes, // an iterable of node objects (typically [{id}, …])
    links // an iterable of link objects (typically [{source, target}, …])
}, {
    nodeId = d => d.id, // given d in nodes, returns a unique identifier (string)
    nodeGroup, // given d in nodes, returns an (ordinal) value for color
    nodeGroupType,
    nodeGroups, // an array of ordinal values representing the node groups
    nodeCommunity,
    nodeInfluence,
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
    width = 1600, // outer width, in pixels
    height = 1000, // outer height, in pixels
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
    const I = nodeInfluence == null ? null : d3.map(nodes, nodeInfluence);
    const COM = nodeCommunity == null ? null : d3.map(nodes, nodeCommunity);

    console.log("nodes", LOC);

    // Replace the input nodes and links with mutable objects for the simulation.
    nodes = d3.map(nodes, (_, i) => ({ id: N[i], group: G && G[i], location: LOC && LOC[i], is_influencer: I && I[i], community: COM && COM[i] }));
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
        .attr("r", (d) => {
            if (nodeGroupType === "influence") {
                return d.is_influencer === true ? 15 : 5;
            } else {
                return nodeRadius;
            }
        })
        .call(drag(simulation))
        .on("mouseover", persist_tooltip)
        .on("mouseout", remove_tooltip)
        .on("click", persist_tooltip)
        .attr("opacity", (d) => {
            if (nodeGroupType === "location") {
                return d.group === "None" ? "0.2" : "1"
            } else {
                return 1;
            }
        });

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
        .attr('transform', `translate(${width / 4}, -${height / 2})`);

    tooltip.append('rect')
        .attr('width', 150)
        .attr('height', 70)
        .attr('fill', 'white')
        .attr('stroke', '#333');

    function add_tooltip(event, d) {
        const tooltip = d3.select("#tooltip");
        tooltip.html(`
        <strong>ID:</strong> ${d.id}<br>
        <strong>Community:</strong>${d.community}<br>
        <strong>Location:</strong> ${d.location}<br>
        <strong>Influence:</strong> ${d.is_influencer}
        `
        );
        tooltip.style("left", event.clientX + "px")
            .style("top", event.clientY + "px")
            .style("display", "block");
    }

    function remove_tooltip() {
        d3.select("#tooltip").style("display", "none");
    }

    function persist_tooltip(event, d) {
        add_tooltip(event, d);
    }
    // function persist_tooltip(event, d) {
    //     // Call the add_tooltip function
    //     add_tooltip(event, d);
    // }

    // function remove_tooltip(event, d) {
    //     // Clear any existing text
    //     tooltip.selectAll('text').remove();

    //     // Hide the tooltip
    //     tooltip.style('display', 'none');
    // }


    // function persist_tooltip(event, d) {
    //     add_tooltip(event, d);
    //     // make sure mouseout doesn't remove the tooltip
    //     tooltip.on('mouseout', () => {});
    // }

    // function remove_tooltip(event, d) {
    //     tooltip.selectAll('text').remove();
    // }

    return Object.assign(svg.node(), { scales: { color } });
}

// d3.json("./2024electionindia.json").then(function (jsonData) {
//     console.log("JSON data fetched:", jsonData);
//     // Create D3.js chart with fetched JSON data
//     const chart = ForceGraph(jsonData, {
//         nodeId: d => d.id,
//         nodeGroup: d => d.group,
//         nodeGeolocation: d => d.location,
//         nodeTitle: d => `${d.id}\n${d.group}`,
//         linkStrokeWidth: l => Math.sqrt(l.weight),
//     });

//     // Select the chart container and append the chart to it
//     d3.select("#chart").append(() => chart);

// }).catch(function (error) {
//     // Handle errors if any
//     console.error("Error fetching JSON data:", error);
// });


function loadGraph(selectedItem) {
    const filePath = `./Graphs/${selectedItem.file}.json`;

    d3.json(filePath)
        .then(function (jsonData) {
            console.log(`JSON data fetched for ${selectedItem.file}:`, jsonData);

            const chart = ForceGraph(jsonData, {
                nodeId: d => d.id,
                nodeGroup: d => {
                    if (selectedItem.grouping === "community") {
                        return d.group;
                    } else if (selectedItem.grouping === "location") {
                        return d.location;
                    } else if (selectedItem.grouping === "influence") {
                        return d.is_influencer;
                    }
                },
                nodeGroupType: selectedItem.grouping,
                nodeCommunity: d => d.group,
                nodeInfluence: d => d.is_influencer,
                nodeGeolocation: d => d.location,
                nodeTitle: d => `${d.id}\n${d.group}`,
                linkStrokeWidth: l => Math.sqrt(l.weight),
            });

            d3.select("#chart").selectAll("*").remove();

            d3.select("#chart").append(() => chart);
        })
        .catch(function (error) {
            console.error(`Error fetching JSON data for ${selectedItem.file}:`, error);
        });
}

function updateGraph(selectedItem) {
    loadGraph(selectedItem);
}


const dropdown = document.getElementById("dropdown");

const dropdown_graph = document.getElementById("dropdown_graph");

dropdown.addEventListener("change", function () {
    const selectedItem = dropdown.value;
    const grouping = dropdown_graph.value;
    updateGraph({
        file: selectedItem,
        grouping: grouping
    });
    loadJSON(selectedItem);

});

dropdown_graph.addEventListener("change", function () {
    const selectedItem = dropdown.value;
    const grouping = dropdown_graph.value;
    updateGraph({
        file: selectedItem,
        grouping: grouping
    });
    loadJSON(selectedItem);
});