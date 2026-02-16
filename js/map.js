document.addEventListener("DOMContentLoaded", function () {

/* ================= GLOBAL VARIABLES ================= */

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

/* ================= MAP INIT ================= */

map = L.map("map").setView([13.0827, 80.2707], 13);

let lightLayer = L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  { attribution: "&copy; OpenStreetMap contributors" }
);

let darkLayer = L.tileLayer(
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
);

lightLayer.addTo(map);

/* ================= DARK MODE ================= */

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

/* ================= AUTO GPS START ================= */

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

if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(
    pos => {
      createStart(pos.coords.latitude, pos.coords.longitude);
      map.setView([pos.coords.latitude, pos.coords.longitude], 14);
    },
    () => createStart(13.0827, 80.2707),
    { enableHighAccuracy: true }
  );
} else {
  createStart(13.0827, 80.2707);
}

/* ================= BUILD ROUTE ================= */

window.buildRoute = async function () {

  if (!window.selectedStart || !window.selectedEnd) {
    alert("Select start and destination first");
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

/* ================= ACTIVATE ROUTE ================= */

function activateRoute(coords, route) {
  fullRoute = coords;
  remainingRoute = [...coords];
  steps = route.legs[0].steps || [];
  stepIndex = 0;
  lastSpokenStep = -1;
}

/* ================= HIGHLIGHT ROUTE ================= */

function highlightRoute(selectedLayer) {
  alternativeLayers.forEach(l =>
    l.setStyle({ color: "#999", weight: 4, opacity: 0.6 })
  );

  selectedLayer.setStyle({
    color: "#007aff",
    weight: 6,
    opacity: 1
  });

  routeLayer = selectedLayer;
}

/* ================= VEHICLE TIMES ================= */

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

/* ================= TRAFFIC ETA ================= */

function simulateTrafficETA(baseTime) {
  const factor = 1 + (Math.random() * 0.3 - 0.15);
  const trafficTime = baseTime * factor;

  const etaEl = document.getElementById("traffic-eta");
  if (etaEl) {
    etaEl.innerText =
      "ETA: " + (trafficTime / 60).toFixed(1) + " mins";
  }
}

/* ================= VOICE ================= */

function speak(text) {
  if (!text) return;
  speechSynthesis.cancel();
  const msg = new SpeechSynthesisUtterance(text);
  msg.lang = "en-IN";
  msg.rate = 1;
  speechSynthesis.speak(msg);
}

/* ================= START NAVIGATION ================= */

window.startNavigation = function () {

  if (!remainingRoute.length) {
    alert("Build route first");
    return;
  }

  if (watchId) navigator.geolocation.clearWatch(watchId);

  navMarker = L.marker(window.selectedStart).addTo(map);

  speak("Navigation started.");

  watchId = navigator.geolocation.watchPosition(onMove, null,
    { enableHighAccuracy: true });
};

/* ================= GPS UPDATE ================= */

function onMove(pos) {

  const cur = {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude
  };

  navMarker.setLatLng(cur);
  map.panTo(cur, { animate: true, duration: 0.5 });

  updateSpeed(cur);
  updateRemainingRoute(cur);
  updateInstruction(cur);
  detectOffRoute(cur);
}

/* ================= OFF ROUTE ================= */

function detectOffRoute(cur) {
  const nearest = remainingRoute.reduce((min, p) => {
    const d = map.distance(cur, p);
    return d < min ? d : min;
  }, Infinity);

  if (nearest > 50) {
    speak("You are off route. Recalculating.");
    window.selectedStart = cur;
    window.buildRoute();
  }
}

/* ================= SPEED ================= */

function updateSpeed(cur) {

  const now = Date.now();

  if (lastPos && lastTime) {
    const d = map.distance(lastPos, cur);
    const t = (now - lastTime) / 1000;
    const speed = (d / t) * 3.6;

    const speedEl = document.getElementById("nav-speed");
    if (speedEl)
      speedEl.innerText = speed.toFixed(1) + " km/h";

    animateSpeedBar(speed);
  }

  lastPos = cur;
  lastTime = now;
}

/* ================= SPEED BAR ================= */

function animateSpeedBar(speed) {
  const bar = document.getElementById("speed-bar");
  if (!bar) return;
  bar.style.width = Math.min(speed, 120) + "%";
}

/* ================= REMAINING DIST ================= */

function updateRemainingRoute(cur) {

  while (remainingRoute.length &&
    map.distance(cur, remainingRoute[0]) < 15) {
    remainingRoute.shift();
  }

  let dist = 0;

  for (let i = 0; i < remainingRoute.length - 1; i++) {
    dist += map.distance(
      remainingRoute[i],
      remainingRoute[i + 1]
    );
  }

  const distEl = document.getElementById("nav-distance");
  if (distEl)
    distEl.innerText = (dist / 1000).toFixed(2) + " km";

  if (routeLayer) map.removeLayer(routeLayer);

  routeLayer = L.polyline(remainingRoute, {
    color: "#007aff",
    weight: 6
  }).addTo(map);
}

/* ================= TURN INSTRUCTION ================= */

function updateInstruction(cur) {

  if (!steps[stepIndex]) return;

  const p = steps[stepIndex].maneuver.location;

  const distance = map.distance(cur, { lat: p[1], lng: p[0] });

  if (distance < 30 && stepIndex !== lastSpokenStep) {
    speak(steps[stepIndex].maneuver.instruction);
    lastSpokenStep = stepIndex;
    stepIndex++;
  }

  if (steps[stepIndex]) {
    const instEl = document.getElementById("nav-instruction");
    if (instEl)
      instEl.innerText =
        steps[stepIndex].maneuver.instruction;
  }
}

/* ================= FORMATTERS ================= */

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

/* ================= VEHICLE SELECT ================= */

window.selectVehicle = function (e, vehicle) {

  document.querySelectorAll(".vehicle")
    .forEach(x => x.classList.remove("active"));

  e.currentTarget.classList.add("active");

  currentVehicle = vehicle;

  if (window.selectedStart && window.selectedEnd)
    window.buildRoute();
};

});
