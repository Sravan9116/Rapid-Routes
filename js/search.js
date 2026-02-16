let debounceTimer;

function suggestPlaces(query, type) {

  if (query.length < 3) return;

  clearTimeout(debounceTimer);

  debounceTimer = setTimeout(async () => {

    const box = document.getElementById(
      type === "start" ? "startSuggestions" : "endSuggestions"
    );

    box.innerHTML = "";

    const url =
      `https://nominatim.openstreetmap.org/search` +
      `?format=json&limit=8&countrycodes=in&q=${encodeURIComponent(query)}`;

    const res = await fetch(url);
    const data = await res.json();

    data.forEach(place => {

      const div = document.createElement("div");
      div.className = "suggestion-item";
      div.innerText = place.display_name;

      div.onclick = () => {

        document.getElementById(type + "Input").value = place.display_name;

        const point = {
          lat: parseFloat(place.lat),
          lng: parseFloat(place.lon)
        };

        // 🔥 IMPORTANT: USE window
        if (type === "start") {
          window.selectedStart = point;
        } else {
          window.selectedEnd = point;
        }

        box.innerHTML = "";
      };

      box.appendChild(div);
    });

  }, 300);
}
