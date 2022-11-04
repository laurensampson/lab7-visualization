/*global d3 */

Promise.all([ // load multiple files
	d3.json('airports.json'),
	d3.json('world-110m.json')
  ]).then(([airports, worldmap]) => {
    let visType = 'force';
    
    const worldmapGeo = topojson.feature(worldmap, worldmap.objects.countries);
    
    const height = 550;
    const width = 1200;
    const svg = d3.select(".airport-chart").append("svg")
        .attr("height", height)
        .attr("width", width)
        .attr("viewBox", [0,0, width, height]);

    const sizingScale = d3.scaleLinear()
        .range([4,15])
        .domain(d3.extent(airports.nodes.map(d => d.passengers)));

    airports.nodes.map(d => d.r = sizingScale(d.passengers));
  
    const proj = d3.geoMercator()
        .fitExtent([[0,0], [width,height]], worldmapGeo);

    const pathGenerator = d3.geoPath().projection(proj);

    const world_map = svg.selectAll("path")
        .data(worldmapGeo.features)
        .join(enter => enter.append("path")
            .attr("d", pathGenerator)
            .attr("opacity", 0.2))
            .style("fill", "black");

    world_map.append("title").text(d => d.properties.name)

    svg.append("path").datum(topojson.mesh(worldmap, worldmap.objects.countries))
        .attr("class", "subunit-boundary")
        .attr("d", pathGenerator)
        .attr('stroke', 'white')
        .attr('fill', 'none');

    const forceCenter = d3.forceCenter(width/2, height/2)
    const forceNode = d3.forceManyBody().strength(-10)
    const forceCollide = d3.forceCollide(d => d.r).iterations(3)
    const forceLink = d3.forceLink(airports.links)

    const sim = d3.forceSimulation(airports.nodes)
        .force("center", forceCenter)
        .force("charge", forceNode)
        .force("collide", forceCollide)
        .force("link", forceLink)

    /*Create the links*/
    const link = svg.append("g").selectAll("line").attr("class", "links").data(airports.links)
        .join(enter => enter.append("line")
                .style("stroke", "lightgreen")
                .style("stroke-width", "2"));

    /*Create the nodes*/
    const nodes = svg.append("g")
        .attr("class","nodes")
        .selectAll("circle")
        .data(airports.nodes)
        .join(enter => enter.append("circle")
                .attr("r", d => d.r)
                .style("fill", "hotpink"));
    
    function ticked() {
        link
            .attr("y1", d => d.source.y)
            .attr("x1", d => d.source.x)
            .attr("y2", d => d.target.y)
            .attr("x2", d => d.target.x)
        nodes
            .attr("cy", d => Math.max(d.r, Math.min(height - d.r, d.y)))
            .attr("cx", d => Math.max(d.r, Math.min(width - d.r, d.x)))
    }
    
    nodes.append("title").text(d => d.name)

    /*Simulation Beginning*/
    sim.on("tick", ticked)

    function dragbegin(event, d) {
        if (!event.active) sim.alphaTarget(0.3).restart();
        d.fy = d.y;
        d.fx = d.x;
    }
    function dragging(event, d) {
        d.fy = event.y;
        d.fx = event.x;
    }
    function dragend(event, d) {
        if (!event.active) sim.alphaTarget(0);
        d.fy = null;
        d.fx = null;
    }

    const handle_drag = d3.drag()
        .on("start", dragbegin)
        .on("drag", dragging)
        .on("end", dragend)

    handle_drag.filter(_ => visType === "force")
    
    /*Calling handling drag*/
    nodes.call(handle_drag)

    function switchLayout() {
        if (visType === "map") {
                /* If it is the map don't simulate*/
                sim.stop()
                /*Otherwise*/
                world_map.attr("opacity",1)
                airports.nodes.map(d => {
                    d.fy = proj([d.longitude, d.latitude])[1]
                    d.fx = proj([d.longitude, d.latitude])[0]
                })
                airports.links.map(d => {
                    d.target.fy = proj([d.target.longitude, d.target.latitude])[1]
                    d.target.fx = proj([d.target.longitude, d.target.latitude])[0]
                    d.source.fy = proj([d.source.longitude, d.source.latitude])[1]
                    d.source.fx = proj([d.source.longitude, d.source.latitude])[0]
                })

                link.transition().duration(750)
                    .attr("y1", d => d.source.fy)
                    .attr("x1", d => d.source.fx)
                    .attr("y2", d => d.target.fy)
                    .attr("x2", d => d.target.fx)
     
                nodes.transition().duration(750).attr("cx", d => d.fx).attr("cy", d => d.fy);

            } else {
                airports.links.map(d => {
                    d.source.fy = null
                    d.source.fx = null
                    d.target.fy = null
                    d.target.fx = null
                })
                airports.nodes.map(d => {
                    d.fy = null
                    d.fx = null
                })
                link.transition().duration(750)
                    .attr("y1", d => d.source.y)
                    .attr("x1", d => d.source.x)
                    .attr("y2", d => d.target.y)
                    .attr("x2", d => d.target.x)

                nodes.transition().duration(750).attr("cx", d => d.x).attr("cy", d => d.y)

                setTimeout(function() {
                    sim.alpha(0.3).restart()
                  }, 750);
                world_map.attr("opacity", 0)}
        }

    d3.selectAll("input[name=chart-type]").on("change", event=>{
        visType = event.target.value;
        switchLayout()
    })
})