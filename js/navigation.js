function startNavigation() {
  if (!routeLayer) {
    alert("Build route first");
    return;
  }

  // Zoom in and lock camera to road
  map.setZoom(17);
}
