const express = require("express");
const router = express.Router();
const axios = require("axios");

router.post("/route", async (req, res) => {
  const { startLat, startLng, endLat, endLng, vehicle } = req.body;

  const profiles = {
    car: "driving",
    bike: "cycling",
    walk: "walking",
    truck: "driving"
  };

  const url =
    `https://router.project-osrm.org/route/v1/${profiles[vehicle]}/` +
    `${startLng},${startLat};${endLng},${endLat}` +
    `?overview=full&geometries=geojson&steps=true`;

  const response = await axios.get(url);
  res.json(response.data);
});

module.exports = router;
