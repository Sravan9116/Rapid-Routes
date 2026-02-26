document.addEventListener("DOMContentLoaded", function () {

/* =====================================================
   GLOBAL VARIABLES
===================================================== */

let map;
let startMarker = null;
let endMarker = null;
let routeLayer = null;
let alternativeLayers = [];
let navMarker = null;
let watchId = null;

let currentVehicle = "car";

let fullRoute = [];
let remainingRoute = [];
let steps = [];
let stepIndex = 0;

let lastPos = null;
let lastTime = null;
let lastSpokenStep = -1;

window.selectedStart = null;
window.selectedEnd = null;

/* =====================================================
   MAP INITIALIZATION
===================================================== */

map = L.map("map").setView([13.0827, 80.2707], 13);
window.map = map;

let lightLayer = L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  { attribution: "&copy; OpenStreetMap contributors" }
);

let darkLayer = L.tileLayer(
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
);

lightLayer.addTo(map);

/* =====================================================
   DARK MODE
===================================================== */

window.toggleDarkMode = function () {
  if (map.hasLayer(lightLayer)) {
    map.removeLayer(lightLayer);
    darkLayer.addTo(map);
    document.body.classList.add("dark");
  } else {
    map.removeLayer(darkLayer);
    lightLayer.addTo(map);
    document.body.classList.remove("dark");
  }
};

/* =====================================================
   GPS PERMISSION (ASK ONCE PER DEVICE)
===================================================== */

function initGPS() {

  if (!navigator.geolocation) {
    createStart(13.0827, 80.2707);
    return;
  }

  if (localStorage.getItem("gpsAllowed") === "true") {
    startWatching();
    return;
  }

  navigator.geolocation.getCurrentPosition(
    pos => {
      localStorage.setItem("gpsAllowed", "true");
      createStart(pos.coords.latitude, pos.coords.longitude);
      map.setView([pos.coords.latitude, pos.coords.longitude], 14);
      startWatching();
    },
    () => createStart(13.0827, 80.2707),
    { enableHighAccuracy: true }
  );
}

function startWatching() {

  if (watchId) navigator.geolocation.clearWatch(watchId);

  watchId = navigator.geolocation.watchPosition(pos => {

    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;

    if (!window.selectedStart) {
      createStart(lat, lng);
    }

  }, null, { enableHighAccuracy: true });
}

function createStart(lat, lng) {

  window.selectedStart = { lat, lng };

  if (startMarker) map.removeLayer(startMarker);

  startMarker = L.marker([lat, lng], { draggable: true })
    .addTo(map)
    .bindPopup("Your Location")
    .openPopup();

  startMarker.on("dragend", () => {
    const p = startMarker.getLatLng();
    window.selectedStart = { lat: p.lat, lng: p.lng };
    if (window.selectedEnd) window.buildRoute();
  });
}

initGPS();

/* =====================================================
   AI DESTINATION HANDLER (FIXED PROPERLY)
===================================================== */

function handleAIDestination() {

  const aiLat = localStorage.getItem("aiTargetLat");
  const aiLng = localStorage.getItem("aiTargetLng");

  if (!aiLat || !aiLng) return;

  window.selectedEnd = {
    lat: parseFloat(aiLat),
    lng: parseFloat(aiLng)
  };

  if (endMarker) map.removeLayer(endMarker);

  endMarker = L.marker(window.selectedEnd)
    .addTo(map)
    .bindPopup("AI Selected Destination")
    .openPopup();

  map.setView([window.selectedEnd.lat, window.selectedEnd.lng], 14);

  const waitForStart = setInterval(() => {
    if (window.selectedStart) {
      clearInterval(waitForStart);
      window.buildRoute();
    }
  }, 400);

  localStorage.removeItem("aiTargetLat");
  localStorage.removeItem("aiTargetLng");
}

/* =====================================================
   BUILD ROUTE
===================================================== */

window.buildRoute = async function () {

  if (!window.selectedStart || !window.selectedEnd) {
    console.log("Start or End missing");
    return;
  }

  if (routeLayer) map.removeLayer(routeLayer);
  alternativeLayers.forEach(l => map.removeLayer(l));
  alternativeLayers = [];

  if (endMarker) map.removeLayer(endMarker);

  endMarker = L.marker(window.selectedEnd)
    .addTo(map)
    .bindPopup("Destination");

  try {

    const res = await fetch("http://localhost:5000/api/navigation/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startLat: window.selectedStart.lat,
        startLng: window.selectedStart.lng,
        endLat: window.selectedEnd.lat,
        endLng: window.selectedEnd.lng,
        vehicle: currentVehicle
      })
    });

    const data = await res.json();
    if (!data.routes || !data.routes.length) return;

    data.routes.forEach((route, index) => {

      const coords = route.geometry.coordinates.map(c => ({
        lat: c[1],
        lng: c[0]
      }));

      const poly = L.polyline(coords, {
        color: index === 0 ? "#007aff" : "#999",
        weight: index === 0 ? 6 : 4,
        opacity: index === 0 ? 1 : 0.6
      }).addTo(map);

      if (index === 0) {
        routeLayer = poly;
        activateRoute(coords, route);
      } else {
        poly.on("click", () => {
          activateRoute(coords, route);
          highlightRoute(poly);
          speak("Alternative route selected.");
        });
        alternativeLayers.push(poly);
      }
    });

    map.fitBounds(routeLayer.getBounds(), { padding: [60, 60] });

    simulateTrafficETA(data.routes[0].duration);
    updateVehicleTimes();

    speak("Route built successfully.");

  } catch (err) {
    console.error("Route error:", err);
  }
};

/* =====================================================
   VEHICLE TIMES
===================================================== */

async function updateVehicleTimes() {

  const vehicles = ["car", "bike", "walk", "truck"];

  const results = await Promise.all(
    vehicles.map(async (v) => {

      const res = await fetch("http://localhost:5000/api/navigation/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startLat: window.selectedStart.lat,
          startLng: window.selectedStart.lng,
          endLat: window.selectedEnd.lat,
          endLng: window.selectedEnd.lng,
          vehicle: v
        })
      });

      const data = await res.json();
      return data.routes?.[0] || null;
    })
  );

  results.forEach((route, index) => {
    if (!route) return;

    const vehicle = vehicles[index];
    const el = document.getElementById(`time-${vehicle}`);

    if (el) {
      el.innerText =
        formatTime(route.duration) +
        " • " +
        formatDistance(route.distance);
    }
  });
}

/* =====================================================
   ROUTE HELPERS
===================================================== */

function activateRoute(coords, route) {
  fullRoute = coords;
  remainingRoute = [...coords];
  steps = route.legs[0].steps || [];
  stepIndex = 0;
  lastSpokenStep = -1;
}

function highlightRoute(selectedLayer) {
  alternativeLayers.forEach(l =>
    l.setStyle({ color: "#999", weight: 4, opacity: 0.6 })
  );
  selectedLayer.setStyle({ color: "#007aff", weight: 6, opacity: 1 });
  routeLayer = selectedLayer;
}

function simulateTrafficETA(baseTime) {
  const factor = 1 + (Math.random() * 0.3 - 0.15);
  const trafficTime = baseTime * factor;
  const etaEl = document.getElementById("traffic-eta");
  if (etaEl)
    etaEl.innerText = "ETA: " + (trafficTime / 60).toFixed(1) + " mins";
}

/* =====================================================
   VOICE
===================================================== */

function speak(text) {
  if (!text) return;
  speechSynthesis.cancel();
  const msg = new SpeechSynthesisUtterance(text);
  msg.lang = "en-IN";
  msg.rate = 1;
  speechSynthesis.speak(msg);
}

/* =====================================================
   FORMATTERS
===================================================== */

function formatTime(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m} min`;
}

function formatDistance(m) {
  return m >= 1000
    ? (m / 1000).toFixed(1) + " km"
    : Math.round(m) + " m";
}

/* =====================================================
   VEHICLE SELECT
===================================================== */

window.selectVehicle = function (e, vehicle) {
  document.querySelectorAll(".vehicle")
    .forEach(x => x.classList.remove("active"));
  e.currentTarget.classList.add("active");
  currentVehicle = vehicle;
  if (window.selectedStart && window.selectedEnd)
    window.buildRoute();
};

/* =====================================================
   INIT AI HANDLER
===================================================== */

setTimeout(handleAIDestination, 1200);

});
