let map, startPoint, endPoint, startMarker, endMarker, routeLayer;
let currentVehicle = "car";
let navMarker, watchId;
let fullRoute = [], remainingRoute = [], steps = [], stepIndex = 0;
let lastPos = null, lastTime = null;

/* INIT MAP */
map = L.map("map").setView([13.0827, 80.2707], 13);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

/* START MARKER */
function createStart(lat, lng) {
  startPoint = { lat, lng };
  selectedStart = startPoint;

  if (startMarker) map.removeLayer(startMarker);

  startMarker = L.marker([lat, lng], { draggable: true })
    .addTo(map)
    .bindPopup("Start")
    .openPopup();

  startMarker.on("dragend", () => {
    const p = startMarker.getLatLng();
    startPoint = { lat: p.lat, lng: p.lng };
    selectedStart = startPoint;
    if (selectedEnd) buildRoute();
  });
}

/* GPS */
navigator.geolocation.getCurrentPosition(
  p => {
    createStart(p.coords.latitude, p.coords.longitude);
    map.setView([p.coords.latitude, p.coords.longitude], 14);
  },
  () => createStart(13.0827, 80.2707)
);

/* BUILD ROUTE */
async function buildRoute() {
  if (!selectedStart || !selectedEnd) {
    alert("Select start & destination");
    return;
  }

  startPoint = selectedStart;
  endPoint = selectedEnd;

  if (endMarker) map.removeLayer(endMarker);
  if (routeLayer) map.removeLayer(routeLayer);

  endMarker = L.marker([endPoint.lat, endPoint.lng]).addTo(map);

  const route = await fetchRoute(currentVehicle);

  fullRoute = route.geometry.coordinates.map(c => ({ lat: c[1], lng: c[0] }));
  remainingRoute = [...fullRoute];
  steps = route.legs[0].steps;
  stepIndex = 0;

  routeLayer = L.polyline(remainingRoute, { color: "#007aff", weight: 5 }).addTo(map);
  map.fitBounds(routeLayer.getBounds(), { padding: [80, 80] });

  updateVehicleTimes();
}

/* ROUTE FETCH */
async function fetchRoute(vehicle) {
  const res = await fetch("http://localhost:5000/api/navigation/route", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      startLat: startPoint.lat,
      startLng: startPoint.lng,
      endLat: endPoint.lat,
      endLng: endPoint.lng,
      vehicle
    })
  });
  const data = await res.json();
  return data.routes[0];
}

/* VEHICLE TIMES */
async function updateVehicleTimes() {
  for (const v of ["car","bike","walk","truck"]) {
    const r = await fetchRoute(v);
    document.getElementById(`time-${v}`).innerText =
      formatTime(r.duration) + " • " + formatDistance(r.distance);
  }
}

/* SELECT VEHICLE */
function selectVehicle(e, v) {
  document.querySelectorAll(".vehicle").forEach(x => x.classList.remove("active"));
  e.currentTarget.classList.add("active");
  currentVehicle = v;
  if (selectedEnd) buildRoute();
}

/* START NAVIGATION */
function startNavigation() {
  if (!remainingRoute.length) {
    alert("Build route first");
    return;
  }

  if (watchId) navigator.geolocation.clearWatch(watchId);

  const iconMap = {
    car: "fa-car", bike: "fa-motorcycle",
    walk: "fa-person-walking", truck: "fa-truck"
  };

  navMarker = L.marker(startPoint, {
    icon: L.divIcon({
      html: `<i class="fa-solid ${iconMap[currentVehicle]}"></i>`,
      className: "nav-icon"
    })
  }).addTo(map);

  watchId = navigator.geolocation.watchPosition(onMove, null,
    { enableHighAccuracy: true, maximumAge: 1000 });
}

/* GPS UPDATE */
function onMove(pos) {
  const cur = { lat: pos.coords.latitude, lng: pos.coords.longitude };
  navMarker.setLatLng(cur);
  map.panTo(cur);

  updateSpeed(cur);
  updateRemainingRoute(cur);
  updateInstruction(cur);
}

/* SPEED */
function updateSpeed(cur) {
  const now = Date.now();
  if (lastPos && lastTime) {
    const d = map.distance(lastPos, cur);
    const t = (now - lastTime) / 1000;
    document.getElementById("nav-speed").innerText =
      ((d / t) * 3.6).toFixed(1) + " km/h";
  }
  lastPos = cur;
  lastTime = now;
}

/* REMAINING DISTANCE */
function updateRemainingRoute(cur) {
  while (remainingRoute.length &&
         map.distance(cur, remainingRoute[0]) < 15) {
    remainingRoute.shift();
  }

  let dist = 0;
  for (let i = 0; i < remainingRoute.length - 1; i++) {
    dist += map.distance(remainingRoute[i], remainingRoute[i + 1]);
  }

  document.getElementById("nav-distance").innerText =
    (dist / 1000).toFixed(2) + " km";

  if (routeLayer) map.removeLayer(routeLayer);
  routeLayer = L.polyline(remainingRoute, { color: "#007aff", weight: 5 }).addTo(map);
}

/* TURN INSTRUCTIONS */
function updateInstruction(cur) {
  if (!steps[stepIndex]) return;
  const p = steps[stepIndex].maneuver.location;
  if (map.distance(cur, { lat: p[1], lng: p[0] }) < 30) stepIndex++;
  if (steps[stepIndex])
    document.getElementById("nav-instruction").innerText =
      steps[stepIndex].maneuver.instruction;
}

/* FORMATTERS */
function formatTime(s) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m} min`;
}
function formatDistance(m) {
  return m >= 1000 ? (m/1000).toFixed(1)+" km" : Math.round(m)+" m";
}
