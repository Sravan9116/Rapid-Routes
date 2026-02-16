const express = require("express");
const router = express.Router();
const pool = require("../db");

router.post("/register", async (req, res) => {
  try {
    const { name, phone, emergency_contact } = req.body;

    const result = await pool.query(
      "INSERT INTO users (name, phone, emergency_contact) VALUES ($1,$2,$3) RETURNING *",
      [name, phone, emergency_contact]
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
