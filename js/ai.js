document.addEventListener("DOMContentLoaded", function () {

    const messageBox = document.getElementById("ai-message");
    const micButton = document.getElementById("ai-mic");

    /* 🔐 NEVER expose real key in production */
    const GEMINI_API_KEY = "AIzaSyCHp09QQAxkOn6iu5CsUKdd5kFU2o98wbk";

    let lastSpeed = 0;
    let accidentTriggered = false;

    /* ================= SPEAK FUNCTION ================= */

    function speak(text) {
        if (!text) return;

        speechSynthesis.cancel();

        const msg = new SpeechSynthesisUtterance(text);
        msg.lang = "en-IN";
        msg.rate = 1;
        speechSynthesis.speak(msg);

        if (messageBox) {
            messageBox.classList.remove("thinking"); // remove thinking
            messageBox.innerText = text;
        }
    }

    /* ================= GEMINI AI ================= */

    async function askGemini(question) {

        try {

            // 🧠 ADD THINKING ANIMATION
            if (messageBox) {
                messageBox.innerText = "Thinking";
                messageBox.classList.add("thinking");
            }

            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{ text: question }]
                        }]
                    })
                }
            );

            const data = await response.json();

            messageBox.classList.remove("thinking"); // remove thinking

            return data?.candidates?.[0]?.content?.parts?.[0]?.text
                || "I'm not sure about that.";

        } catch (err) {

            messageBox.classList.remove("thinking"); // remove thinking

            console.log(err);
            return "AI service unavailable.";
        }
    }

    /* ================= DESTINATION EXTRACTOR ================= */

    function extractDestination(text) {

        const patterns = [
            "go to",
            "take me to",
            "navigate to",
            "direction to",
            "show route to",
            "let me go to",
            "let me to",
            "i want to go to",
            "i want to navigate to",
            "i want direction to",
            "i want show route to",
            "i want to go",
            "i want to navigate",
            "i want direction",
            "i want show route",
            "navigate",
            "direction",
            "show route",
            "go",
            "take me"
        ];

        for (let phrase of patterns) {
            if (text.includes(phrase)) {
                return text.replace(phrase, "").trim();
            }
        }

        return null;
    }

    /* ================= VOICE RECOGNITION ================= */

    const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        speak("Voice recognition not supported.");
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = async function (event) {

        const speechText =
            event.results[0][0].transcript.toLowerCase();

        if (messageBox)
            messageBox.innerText = "You said: " + speechText;

        /* ===== DESTINATION COMMAND ===== */

        const destination = extractDestination(speechText);

        if (destination) {

            document.getElementById("endInput").value = destination;

            if (typeof suggestPlaces === "function") {
                suggestPlaces(destination, "end");
            }

            speak("Searching for " + destination);

            setTimeout(() => {

                const suggestions =
                    document.querySelectorAll("#endSuggestions .suggestion-item");

                if (suggestions.length > 0) {

                    suggestions[0].click();

                    speak("Destination set to " + destination);

                    if (typeof buildRoute === "function") {
                        buildRoute();
                    }

                } else {
                    speak("Location not found.");
                }

            }, 2000);

            return;
        }

        /* ===== START NAVIGATION ===== */

        if (speechText.includes("start navigation")) {

            if (typeof startNavigation === "function") {
                startNavigation();
                speak("Navigation started.");
            }

            return;
        }

        /* ===== RESTAURANT SEARCH ===== */

        if (
            speechText.includes("restaurant") ||
            speechText.includes("food") ||
            speechText.includes("lunch")
        ) {
            findNearby("restaurant");
            return;
        }

        /* ===== GENERAL AI ===== */

        const aiReply = await askGemini(
            "You are a smart navigation assistant. Answer briefly: " + speechText
        );

        speak(aiReply);
    };

    recognition.onerror = function () {
        speak("I couldn't hear you clearly.");
    };

    micButton.onclick = function () {
        recognition.start();
        if (messageBox) messageBox.innerText = "Listening...";
    };

    /* ================= OVERPASS RESTAURANT ================= */

    async function findNearby(type) {

        if (!window.selectedStart) {
            speak("Location not available.");
            return;
        }

        const lat = window.selectedStart.lat;
        const lon = window.selectedStart.lng;

        const query = `
        [out:json];
        node["amenity"="${type}"](around:2000,${lat},${lon});
        out;
        `;

        try {

            const response = await fetch(
                "https://overpass-api.de/api/interpreter",
                {
                    method: "POST",
                    body: query
                }
            );

            const data = await response.json();

            if (!data.elements.length) {
                speak("No nearby " + type + " found.");
                return;
            }

            const place = data.elements[0];
            const name = place.tags.name || type;

            speak("I found " + name + " nearby.");

            if (typeof L !== "undefined") {
                L.marker([place.lat, place.lon])
                    .addTo(window.map)
                    .bindPopup(name)
                    .openPopup();
            }

        } catch {
            speak("Unable to fetch nearby places.");
        }
    }

    /* ================= ACCIDENT DETECTION ================= */

    setInterval(() => {

        const speedEl = document.getElementById("nav-speed");
        if (!speedEl) return;

        const currentSpeed =
            parseFloat(speedEl.innerText) || 0;

        if (lastSpeed > 40 && currentSpeed < 5 && !accidentTriggered) {

            accidentTriggered = true;

            speak("Sudden stop detected. Are you safe?");

            if (typeof triggerEmergency === "function") {
                triggerEmergency();
            }
        }

        lastSpeed = currentSpeed;

    }, 8000);

});
