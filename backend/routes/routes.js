const router = require("express").Router();
const axios = require("axios");

router.post("/route", async (req,res)=>{
  const {lat,lng,endLat,endLng,vehicle} = req.body;

  const map = { car:"driving", bike:"cycling", truck:"driving" };
  const profile = map[vehicle]||"driving";

  const url = `https://router.project-osrm.org/route/v1/${profile}/${lng},${lat};${endLng},${endLat}?overview=full&geometries=geojson`;

  try{
    const r = await axios.get(url);
    res.json(r.data);
  }catch{
    res.status(500).json({error:"Routing failed"});
  }
});

module.exports = router;
