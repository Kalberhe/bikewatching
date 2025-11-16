console.log("Mapbox GL JS Loaded:", mapboxgl);

mapboxgl.accessToken = "pk.eyJ1Ijoia2FsYmVyaGUiLCJhIjoiY21pMHp5a2Z1MTVmMDJ3cTY0MWVqeThhMiJ9.ouuEXzVnn7gEK3uWa6pWLw";

const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/mapbox/streets-v12",
  center: [-71.09415, 42.36027], 
  zoom: 12,
  minZoom: 5,
  maxZoom: 18,
})

map.on("load", () => {
  console.log("Map has loaded!");

  // Add the bike network source (large dataset fix)
  map.addSource("bike-network", {
    type: "geojson",
    data: "https://kalberhe.github.io/bikewatching/Existing_Bike_Network_2022.geojson",
    generateId: true
  });

  // Add the bike lane layer ABOVE labels
  map.addLayer(
    {
      id: "bike-network-layer",
      type: "line",
      source: "bike-network",
      paint: {
  "line-color": [
    "match",
    ["get", "ExisFacil"],
    "BL", "#0080ff",     
    "SLM", "#ffa500",    
    "SBL", "#ff0000",   
    "DIV", "#00cc44",    
    "BLD", "#8000ff",     
    "#999999"            
  ],
  "line-width": 3,
  "line-opacity": 0.9
}

    },
    "waterway-label"
  );
});

