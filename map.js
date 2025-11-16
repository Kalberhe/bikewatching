console.log("Mapbox GL JS Loaded:", mapboxgl);

mapboxgl.accessToken =
  "pk.eyJ1Ijoia2FsYmVyaGUiLCJhIjoiY21pMHp5a2Z1MTVmMDJ3cTY0MWVqeThhMiJ9.ouuEXzVnn7gEK3uWa6pWLw";

const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/mapbox/streets-v12",
  center: [-71.09415, 42.36027],
  zoom: 12,
  minZoom: 5,
  maxZoom: 18,
});

map.on("load", () => {
  console.log("Map has loaded!");

  map.addSource("bike-network", {
    type: "geojson",
    data: "https://kalberhe.github.io/bikewatching/Existing_Bike_Network_2022.geojson",
    generateId: true,
  });

  map.addLayer(
    {
      id: "bike-network-layer",
      type: "line",
      source: "bike-network",
      paint: {
        "line-color": [
          "match",
          ["get", "ExisFacil"],
          "BL",
          "#0080ff",
          "SLM",
          "#ffa500",
          "SBL",
          "#ff0000",
          "DIV",
          "#00cc44",
          "BLD",
          "#8000ff",
          "#999999",
        ],
        "line-width": 3,
        "line-opacity": 0.9,
      },
    },
    "waterway-label"
  );

  const svg = d3
    .select(map.getCanvasContainer())
    .append("svg")
    .attr("class", "stations-overlay");

  const stationGroup = svg.append("g").attr("class", "stations");

  
  const tooltip = d3
    .select("body")
    .append("div")
    .attr("class", "tooltip hidden");


  function updatePositions() {
    stationGroup
      .selectAll("circle")
      .attr("cx", (d) => map.project([d.lon, d.lat]).x)
      .attr("cy", (d) => map.project([d.lon, d.lat]).y);
  }

function renderStations() {
  stationGroup
    .selectAll("circle")
    .data(window.stations)
    .join("circle")
    .attr("r", 6);   
    

  updatePositions();
}



  map.on("move", updatePositions);
  map.on("moveend", updatePositions);

  let radiusScale; 

  const flowColor = d3
    .scaleQuantize()
    .domain([0, 1])
    .range([
      "#d73027", 
      "#fee08b", 
      "#1a9850", 
    ]);

    function applyTrafficSizeAndColor() {
    const circles = stationGroup
      .selectAll("circle")
      .transition()
      .duration(800)
      .attr("r", (d) =>
        radiusScale ? radiusScale(d.totalTraffic) : 4
      ) 
      .attr("fill", (d) =>
        d.flowRatio === undefined ? "red" : flowColor(d.flowRatio)
      ); 

    stationGroup
  .selectAll("circle")
  .on("mouseenter", (event, d) => {
    tooltip
      .classed("hidden", false)
      .html(
        `<strong>${d.name}</strong><br/>
         Total trips: ${d.totalTraffic}<br/>
         Arrivals: ${d.arrivals}<br/>
         Departures: ${d.departures}`
      );
  })
  .on("mousemove", (event, d) => {
    tooltip
      .style("left", event.pageX + 10 + "px")
      .style("top", event.pageY + 10 + "px");
  })
  .on("mouseleave", () => {
    tooltip.classed("hidden", true);
  });

  }


  function loadTraffic() {
    d3.csv(
      "https://kalberhe.github.io/bikewatching/bluebikes-traffic-2024-03.csv",
      d3.autoType
    ).then((trips) => {
      console.log("Trips loaded:", trips.length);
      console.log("Example trip row:", trips[0]);
      console.log("Trip keys:", Object.keys(trips[0]));

      const startKey =
        "start_station_id" in trips[0]
          ? "start_station_id"
          : "start_station";
      const endKey =
        "end_station_id" in trips[0]
          ? "end_station_id"
          : "end_station";

      console.log("Using keys:", { startKey, endKey });

      const departures = d3.rollup(
        trips,
        (v) => v.length,
        (d) => String(d[startKey])
      );

      const arrivals = d3.rollup(
        trips,
        (v) => v.length,
        (d) => String(d[endKey])
      );

      console.log("Unique departure stations:", departures.size);
      console.log("Unique arrival stations:", arrivals.size);

      window.stations.forEach((st) => {
        const id = String(st.id);

        st.departures = departures.get(id) ?? 0;
        st.arrivals = arrivals.get(id) ?? 0;
        st.totalTraffic = st.departures + st.arrivals;

        st.flowRatio =
          st.totalTraffic === 0
            ? 0.5
            : st.arrivals / st.totalTraffic;
      });

      console.log(
        "Max totalTraffic:",
        d3.max(window.stations, (d) => d.totalTraffic)
      );

      radiusScale = d3
        .scaleSqrt()
        .domain([0, d3.max(window.stations, (d) => d.totalTraffic)])
        .range([2, 25]);

      applyTrafficSizeAndColor();
    });
  }


fetch("https://dsc106.com/labs/lab07/data/bluebikes-stations.json")
  .then((response) => response.json())
  .then((json) => {
    const rawStations = json.data.stations;

    window.stations = rawStations.map((st) => ({
      id: String(st.short_name),  
      name: st.name,
      lat: st.lat,
      lon: st.lon,
      capacity: st.capacity,
    }));

    console.log("First station:", window.stations[0]);

    renderStations();
    loadTraffic();
  });

});
