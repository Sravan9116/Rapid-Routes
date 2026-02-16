const express = require("express");
const router = express.Router();
const pool = require("../db");

router.post("/report", async (req, res) => {
  try {
    const { type, description, lat, lng } = req.body;

    await pool.query(
      `INSERT INTO incidents (type, description, location)
       VALUES ($1, $2, ST_SetSRID(ST_MakePoint($4,$3),4326)::geography)`,
      [type, description, lat, lng]
    );

    res.json({ message: "Incident reported successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
