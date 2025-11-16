// =======================
// Global helpers
// =======================

let timeFilter = -1;     // -1 = any time
let radiusScale;         // D3 scale for circle radius

// departures vs arrivals -> legend color buckets if you want them
const stationFlow = d3.scaleQuantize()
  .domain([0, 1])
  .range([0, 0.5, 1]);

function formatTime(minutes) {
  const date = new Date(0, 0, 0, 0, minutes);
  return date.toLocaleString("en-US", { timeStyle: "short" });
}

function minutesSinceMidnight(date) {
  return date.getHours() * 60 + date.getMinutes();
}

// Compute arrivals / departures / total for each station
function computeStationTraffic(stations, trips) {
  // departures: count trips by start station
  const departures = d3.rollup(
    trips,
    (v) => v.length,
    (d) => d.start_station_id
  );

  // arrivals: count trips by end station
  const arrivals = d3.rollup(
    trips,
    (v) => v.length,
    (d) => d.end_station_id
  );

  // update each station object in-place and return array
  return stations.map((station) => {
    const id = station.short_name;  // NOTE: matches start/end_station_id

    station.departures = departures.get(id) ?? 0;
    station.arrivals   = arrivals.get(id) ?? 0;
    station.totalTraffic = station.departures + station.arrivals;

    // for flow coloring / legend
    station.flowRatio =
      station.totalTraffic === 0
        ? 0.5
        : station.departures / station.totalTraffic;

    return station;
  });
}

// Filter trips to those within ±60 minutes of timeFilter
function filterTripsByTime(trips, timeFilter) {
  if (timeFilter === -1) {
    // no filter -> all trips
    return trips;
  }

  return trips.filter((trip) => {
    const startedMinutes = minutesSinceMidnight(trip.started_at);
    const endedMinutes   = minutesSinceMidnight(trip.ended_at);

    return (
      Math.abs(startedMinutes - timeFilter) <= 60 ||
      Math.abs(endedMinutes - timeFilter)   <= 60
    );
  });
}

// =======================
// Mapbox + D3 overlay
// =======================

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

map.on("load", async () => {
  console.log("Map has loaded!");

  // ---- Bike network layer ----
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
          "BL",  "#0080ff",
          "SLM", "#ffa500",
          "SBL", "#ff0000",
          "DIV", "#00cc44",
          "BLD", "#8000ff",
          "#999999"
        ],
        "line-width": 3,
        "line-opacity": 0.9,
      },
    },
    "waterway-label"
  );

  // ---- SVG overlay for stations ----
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

  map.on("move", updatePositions);
  map.on("moveend", updatePositions);

  // ---- Load stations + trips ----
  const jsonData = await d3.json(
    "https://dsc106.com/labs/lab07/data/bluebikes-stations.json"
  );
  // raw station objects from JSON
  let stations = jsonData.data.stations;

  // trips with started_at / ended_at parsed as Date
  let trips = await d3.csv(
    "https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv",
    (trip) => {
      trip.started_at = new Date(trip.started_at);
      trip.ended_at   = new Date(trip.ended_at);
      return trip;
    }
  );

  // compute traffic for ALL trips (no time filter)
  stations = computeStationTraffic(stations, trips);

  // global radius scale: domain is based on all traffic
  radiusScale = d3
    .scaleSqrt()
    .domain([0, d3.max(stations, (d) => d.totalTraffic)])
    .range([0, 25]); // default range for "any time"

  // ---- Initial circles (keyed by short_name so D3 can track them) ----
  let circles = stationGroup
    .selectAll("circle")
    .data(stations, (d) => d.short_name)
    .join("circle")
    .attr("r", (d) => radiusScale(d.totalTraffic))
    .style("--departure-ratio", (d) =>
      d.totalTraffic ? stationFlow(d.departures / d.totalTraffic) : 0.5
    );

  updatePositions();

  // tooltip handlers
  circles
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
    .on("mousemove", (event) => {
      tooltip
        .style("left", event.pageX + 10 + "px")
        .style("top", event.pageY + 10 + "px");
    })
    .on("mouseleave", () => {
      tooltip.classed("hidden", true);
    });

  // =======================
  // Step 5.3 — filtering + updateScatterPlot
  // =======================

  function updateScatterPlot(timeFilter) {
    // 1. filter trips based on timeFilter
    const filteredTrips = filterTripsByTime(trips, timeFilter);

    // 2. recompute station traffic from the filtered trips
    const filteredStations = computeStationTraffic(stations, filteredTrips);

    // 3. change radiusScale range depending on whether filter is active
    if (timeFilter === -1) {
      radiusScale.range([0, 25]);   // all trips
    } else {
      radiusScale.range([3, 50]);   // filtered window -> larger, but still ∝ totalTraffic
    }

    // 4. update circles with new data (keyed by short_name)
    circles = stationGroup
      .selectAll("circle")
      .data(filteredStations, (d) => d.short_name)
      .join("circle")
      .attr("r", (d) => radiusScale(d.totalTraffic))
      .style("--departure-ratio", (d) =>
        d.totalTraffic ? stationFlow(d.departures / d.totalTraffic) : 0.5
      );

    updatePositions();

    // reattach tooltip events for the (possibly rejoined) circles
    circles
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
      .on("mousemove", (event) => {
        tooltip
          .style("left", event.pageX + 10 + "px")
          .style("top", event.pageY + 10 + "px");
      })
      .on("mouseleave", () => {
        tooltip.classed("hidden", true);
      });
  }

  // ---- Slider wiring: updateTimeDisplay calls updateScatterPlot ----
  const timeSlider   = document.getElementById("time-slider");
  const selectedTime = document.getElementById("selected-time");
  const anyTimeLabel = document.getElementById("any-time");

  function updateTimeDisplay() {
    const value = Number(timeSlider.value);
    timeFilter = value;

    if (timeFilter === -1) {
      selectedTime.textContent = "";
      anyTimeLabel.style.display = "inline";
    } else {
      selectedTime.textContent = formatTime(timeFilter);
      anyTimeLabel.style.display = "none";
    }

    // 🔁 actually update the circles
    updateScatterPlot(timeFilter);
  }

  timeSlider.addEventListener("input", updateTimeDisplay);

  // initialize display + scatterplot
  updateTimeDisplay();
});
