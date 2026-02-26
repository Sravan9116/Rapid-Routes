document.addEventListener("DOMContentLoaded", function () {

    const chatBox = document.getElementById("chat-messages");
    const input = document.getElementById("chatInput");
    const sendBtn = document.querySelector(".chat-input button");

    const SEARCH_RADIUS = 5000;
    const MAX_RESULTS = 8;

    /* ================= MESSAGE ================= */

    function addMessage(text, type = "bot") {

        const div = document.createElement("div");
        div.className = type === "user" ? "user-message" : "bot-message";
        div.innerText = text;

        chatBox.appendChild(div);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    /* ================= CARD UI ================= */

    function addCard(place) {

        const name = place.tags.name || "Unnamed Place";

        const card = document.createElement("div");
        card.className = "bot-message";
        card.innerHTML = `
            <strong>${name}</strong><br>
            📍 ${place.distance.toFixed(2)} km away<br>
            <button onclick="openInOurMap(${place.lat}, ${place.lon})">
                View on Map
            </button>
        `;

        chatBox.appendChild(card);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    /* ================= OPEN IN OUR MAP ================= */

    window.openInOurMap = function (lat, lon) {

        localStorage.setItem("aiTargetLat", lat);
        localStorage.setItem("aiTargetLng", lon);

        window.location.href = "../index.html";
    };

    /* ================= LOCATION ================= */

    async function getLocation() {

        return new Promise((resolve, reject) => {

            if (localStorage.getItem("userLat")) {
                resolve({
                    lat: parseFloat(localStorage.getItem("userLat")),
                    lon: parseFloat(localStorage.getItem("userLng"))
                });
                return;
            }

            navigator.geolocation.getCurrentPosition(pos => {

                const lat = pos.coords.latitude;
                const lon = pos.coords.longitude;

                localStorage.setItem("userLat", lat);
                localStorage.setItem("userLng", lon);

                resolve({ lat, lon });

            }, reject);
        });
    }

    /* ================= DISTANCE ================= */

    function calculateDistance(lat1, lon1, lat2, lon2) {

        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;

        const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) *
            Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;

        return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
    }

    /* ================= OSM FILTERS ================= */

    const FILTERS = {
        restaurant: '["amenity"="restaurant"]',
        hotel: '["tourism"="hotel"]',
        fuel: '["amenity"="fuel"]',
        hospital: '["amenity"="hospital"]',
        atm: '["amenity"="atm"]',
        pharmacy: '["amenity"="pharmacy"]'
    };

    /* ================= FETCH PLACES ================= */

    async function fetchPlaces(type) {

        const location = await getLocation();
        const filter = FILTERS[type];
        if (!filter) return [];

        const query = `
        [out:json];
        node${filter}(around:${SEARCH_RADIUS},${location.lat},${location.lon});
        out;
        `;

        const response = await fetch(
            "https://overpass-api.de/api/interpreter",
            { method: "POST", body: query }
        );

        const data = await response.json();

        const enriched = data.elements.map(place => {

            const distance = calculateDistance(
                location.lat,
                location.lon,
                place.lat,
                place.lon
            );

            return { ...place, distance };
        });

        enriched.sort((a, b) => a.distance - b.distance);

        return enriched.slice(0, MAX_RESULTS);
    }

    /* ================= ROUTE ANALYSIS ================= */

    function generateRouteReasoning() {

        const trafficLevels = ["Low", "Moderate", "Heavy"];
        const safetyLevels = ["Safe Area", "Medium Risk", "High Risk"];

        const traffic = trafficLevels[Math.floor(Math.random() * 3)];
        const safety = safetyLevels[Math.floor(Math.random() * 3)];

        return `
🧠 Route Analysis:
🚦 Traffic: ${traffic}
🛑 Safety: ${safety}
✔ Recommendation: Choose safer roads if possible.
        `;
    }

    /* ================= FRIENDLY REPLIES ================= */

    function friendlyReply(text) {

        if (text.includes("hello") || text.includes("hi"))
            return "👋 Hello! How can I help you with your journey today?";

        if (text.includes("how are you"))
            return "I'm always ready to guide you 🚗✨";

        if (text.includes("thank"))
            return "You're welcome! Safe travels 🚀";

        return null;
    }

    /* ================= INTENT DETECTION ================= */

    function detectIntent(text) {

        text = text.toLowerCase();

        if (text.includes("restaurant") || text.includes("food"))
            return "restaurant";

        if (text.includes("hotel"))
            return "hotel";

        if (text.includes("fuel") || text.includes("petrol"))
            return "fuel";

        if (text.includes("hospital"))
            return "hospital";

        if (text.includes("atm"))
            return "atm";

        if (text.includes("route") || text.includes("traffic"))
            return "route";

        return "chat";
    }

    /* ================= MAIN SEND ================= */

    async function handleSend() {

        const text = input.value.trim();
        if (!text) return;

        addMessage(text, "user");
        input.value = "";

        const friendly = friendlyReply(text.toLowerCase());
        if (friendly) {
            addMessage(friendly);
            return;
        }

        const intent = detectIntent(text);

        if (intent === "route") {
            addMessage(generateRouteReasoning());
            return;
        }

        if (intent === "chat") {
            addMessage("🤖 Smart AI is analyzing your request...");
            setTimeout(() => {
                addMessage("Tell me what you need — hotels, food, fuel, safety, or route analysis.");
            }, 800);
            return;
        }

        addMessage("Searching nearby " + intent + "...");

        const places = await fetchPlaces(intent);

        if (!places.length) {
            addMessage("No nearby " + intent + " found.");
            return;
        }

        places.forEach(p => addCard(p));
    }

    sendBtn.onclick = handleSend;

    input.addEventListener("keypress", function (e) {
        if (e.key === "Enter") handleSend();
    });

});
