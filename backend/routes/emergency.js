const express = require("express");
const router = express.Router();

router.post("/trigger", (req, res) => {
  console.log("🚨 Emergency:", req.body);
  res.json({ message: "Emergency alert sent" });
});

module.exports = router;
