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
  map.addSource("bike-network", {
  type: "geojson",
  data: "https://kalberhe.github.io/bikewatching/data/Existing_Bike_Network_2022.geojson"
});

map.addLayer({
  id: "bike-network-layer",
  type: "line",
  source: "bike-network",
 paint: {
  "line-color": "#0080ff",
  "line-width": 3,
  "line-opacity": 0.8
}
});
});
