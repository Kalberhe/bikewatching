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

  // -------------------------------
  // STEP 2 — Bike lanes
  // -------------------------------
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

  // -------------------------------
  // STEP 3.2 — Create SVG Overlay
  // -------------------------------
  const container = map.getCanvasContainer();

  const svg = d3
    .select(container)
    .append("svg")
    .attr("class", "stations-overlay");

  const stationGroup = svg.append("g").attr("class", "stations");

  // Position updater
  function updatePositions() {
    stationGroup
      .selectAll("circle")
      .attr("cx", (d) => map.project([d.lon, d.lat]).x)
      .attr("cy", (d) => map.project([d.lon, d.lat]).y);
  }

  // Renderer
  function renderStations() {
    stationGroup
      .selectAll("circle")
      .data(window.stations)
      .join("circle")
      .attr("r", 4)
      .attr("fill", "red")
      .attr("stroke", "white")
      .attr("stroke-width", 1);

    updatePositions();
  }

  // -------------------------------
  // STEP 3.1 — Load Station Data
  // -------------------------------
  fetch("https://dsc106.com/labs/lab07/data/bluebikes-stations.json")
    .then((r) => r.json())
    .then((json) => {
      const rawStations = json.data.stations;

      window.stations = rawStations.map((st) => ({
        id: st.station_id,
        name: st.name,
        lat: st.lat,
        lon: st.lon,
        capacity: st.capacity,
      }));

      console.log("Stations loaded:", window.stations);

      // NOW render stations
      renderStations();
    });

  // Keep repositioning circles on map move
  map.on("move", updatePositions);
  map.on("moveend", updatePositions);
});
