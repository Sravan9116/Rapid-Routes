const express = require("express");
const router = express.Router();
const axios = require("axios");

router.post("/route", async (req, res) => {

  try {

    const { startLat, startLng, endLat, endLng, vehicle } = req.body;

    let profile = "driving";

    if (vehicle === "bike") profile = "cycling";
    if (vehicle === "walk") profile = "foot";
    if (vehicle === "truck") profile = "driving";

    const url =
      `https://router.project-osrm.org/route/v1/${profile}/` +
      `${startLng},${startLat};${endLng},${endLat}` +
      `?overview=full&geometries=geojson&steps=true`;

    const response = await axios.get(url);

    let data = response.data;

    // 🔥 FORCE VEHICLE SPEED DIFFERENCE
    const speedMultiplier = {
      car: 1,
      truck: 1.2,   // slower than car
      bike: 2,      // slower
      walk: 6       // much slower
    };

    const multiplier = speedMultiplier[vehicle] || 1;

    data.routes[0].duration =
      data.routes[0].duration * multiplier;

    res.json(data);

  } catch (error) {
    console.error("Routing error:", error.message);
    res.status(500).json({ error: "Routing failed" });
  }
});

module.exports = router;
