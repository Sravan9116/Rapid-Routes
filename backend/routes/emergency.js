const express = require("express");
const router = express.Router();
const twilio = require("twilio");

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

router.post("/", async (req, res) => {

  try {

    const { lat, lng } = req.body;

    if (!lat || !lng) {
      return res.status(400).json({ error: "Location missing" });
    }

    const locationLink = `https://www.google.com/maps?q=${lat},${lng}`;

    const messageBody =
      `🚨 EMERGENCY ALERT 🚨\n\n` +
      `Your family member might be in trouble.\n\n` +
      `📍 Live Location:\n${locationLink}\n\n` +
      `Please contact immediately.`;

    /* ================= WHATSAPP MESSAGE ================= */

    const whatsappMsg = client.messages.create({
      from: process.env.TWILIO_WHATSAPP_NUMBER,
      to: process.env.FAMILY_WHATSAPP_NUMBER,
      body: messageBody
    });

    /* ================= VOICE CALL ================= */

    const call = client.calls.create({
      to: process.env.FAMILY_PHONE_NUMBER,
      from: process.env.TWILIO_PHONE_NUMBER,
      twiml: `
        <Response>
          <Say voice="alice">
            Emergency alert. Your family member may be in danger.
          </Say>
          <Pause length="1"/>
          <Say voice="alice">
            Location has been sent to your WhatsApp.
          </Say>
          <Pause length="1"/>
          <Say voice="alice">
            Please contact them immediately.
          </Say>
        </Response>
      `
    });

    await Promise.all([whatsappMsg, call]);

    console.log("WhatsApp & Call Triggered");

    res.json({ success: true });

  } catch (err) {
    console.error("TWILIO ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
