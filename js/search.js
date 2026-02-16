let selectedStart = null;
let selectedEnd = null;
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
      `?format=json&addressdetails=1&limit=8&countrycodes=in&q=${encodeURIComponent(query)}`;

    const res = await fetch(url, {
      headers: { "User-Agent": "SafeRouteApp/1.0" }
    });

    const data = await res.json();

    data.forEach(place => {
      const div = document.createElement("div");
      div.className = "suggestion-item";
      div.innerText = place.display_name;

      div.onclick = () => {
        document.getElementById(type + "Input").value = place.display_name;
        const point = { lat: +place.lat, lng: +place.lon };
        if (type === "start") selectedStart = point;
        else selectedEnd = point;
        box.innerHTML = "";
      };
      box.appendChild(div);
    });
  }, 300);
}
