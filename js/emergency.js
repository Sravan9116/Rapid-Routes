function triggerEmergency() {
  navigator.geolocation.getCurrentPosition(pos => {
    fetch("http://localhost:5000/api/emergency/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: 1,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      })
    });
    alert("Emergency alert sent");
  });
}
