document.addEventListener("DOMContentLoaded", function () {

    const chatBox = document.getElementById("chat-messages");
    const input = document.getElementById("chat-input");
    const sendBtn = document.getElementById("chat-send");

    function addMessage(text, type) {
        const div = document.createElement("div");
        div.className = "message " + type;
        div.innerText = text;
        chatBox.appendChild(div);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    async function fetchNearby(type) {

        if (!localStorage.getItem("userLat")) return;

        const lat = localStorage.getItem("userLat");
        const lon = localStorage.getItem("userLng");

        const query = `
        [out:json];
        node["amenity"="${type}"](around:3000,${lat},${lon});
        out;
        `;

        const response = await fetch(
            "https://overpass-api.de/api/interpreter",
            { method: "POST", body: query }
        );

        const data = await response.json();

        return data.elements.slice(0, 5);
    }

    sendBtn.onclick = async function () {

        const text = input.value.trim();
        if (!text) return;

        addMessage(text, "user");
        input.value = "";

        if (text.includes("restaurant")) {
            const places = await fetchNearby("restaurant");
            addMessage("Here are nearby restaurants:", "bot");
            places.forEach(p =>
                addMessage(p.tags.name || "Restaurant", "bot")
            );
            return;
        }

        if (text.includes("hotel")) {
            const hotels = await fetchNearby("hotel");
            addMessage("Here are nearby hotels:", "bot");
            hotels.forEach(h =>
                addMessage(h.tags.name || "Hotel", "bot")
            );
            return;
        }

        addMessage("Planning your journey...", "bot");
    };

    /* Planner Buttons */

    window.suggestScenic = () =>
        addMessage("Analyzing scenic routes...", "bot");

    window.suggestFood = () =>
        addMessage("Finding best restaurants...", "bot");

    window.safetyCheck = () =>
        addMessage("Checking safety alerts on route...", "bot");

    window.accidentAnalysis = () =>
        addMessage("Analyzing accident risk patterns...", "bot");

});
