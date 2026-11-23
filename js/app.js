/* ===================== Constants & State ===================== */
const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
const WEATHER_URL = "https://api.open-meteo.com/v1/forecast";
const DEFAULT_CITY = { name: "Dhaka", country: "Bangladesh", latitude: 23.7104, longitude: 90.4074 };

const WEATHER_CODES = {
  0: ["Clear sky", "☀️"], 1: ["Mainly clear", "🌤️"], 2: ["Partly cloudy", "⛅"], 3: ["Overcast", "☁️"],
  45: ["Fog", "🌫️"], 48: ["Rime fog", "🌫️"],
  51: ["Light drizzle", "🌦️"], 53: ["Drizzle", "🌦️"], 55: ["Heavy drizzle", "🌦️"],
  61: ["Light rain", "🌧️"], 63: ["Rain", "🌧️"], 65: ["Heavy rain", "🌧️"],
  71: ["Light snow", "🌨️"], 73: ["Snow", "🌨️"], 75: ["Heavy snow", "❄️"],
  80: ["Rain showers", "🌦️"], 81: ["Rain showers", "🌧️"], 82: ["Violent showers", "⛈️"],
  95: ["Thunderstorm", "⛈️"], 96: ["Thunderstorm, hail", "⛈️"], 99: ["Severe thunderstorm", "⛈️"]
};

const state = {
  city: null,          // currently displayed city object
  data: null,          // last API response (always in °C)
  days: [],            // processed forecast days (array of objects)
  unit: "C",
  filter: "all",
  selectedDate: null,
  favorites: []        // array of city objects
};

/* ===================== DOM references ===================== */
const $ = (id) => document.getElementById(id);
const searchForm = $("searchForm");
const searchInput = $("searchInput");
const resultsEl = $("results");
const favoritesEl = $("favorites");
const statusEl = $("status");
const weatherEl = $("weather");
const currentPanel = $("currentPanel");
const forecastEl = $("forecast");
const detailEl = $("detail");
const filtersEl = $("filters");

/* ===================== Local Storage helpers ===================== */
function saveToStorage(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { console.warn("Storage unavailable", e); }
}
function loadFromStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) { return fallback; }
}

/* ===================== Utility ===================== */
const describe = (code) => WEATHER_CODES[code] || ["Unknown", "❓"];
const toUnit = (c) => state.unit === "C" ? Math.round(c) : Math.round(c * 9 / 5 + 32);
const unitLabel = () => "°" + state.unit;
const sameCity = (a, b) =>
  Math.abs(a.latitude - b.latitude) < 0.001 && Math.abs(a.longitude - b.longitude) < 0.001;
const cityKey = (c) => c.name + (c.country ? ", " + c.country : "");

function formatDay(dateStr, index) {
  if (index === 0) return "Today";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

/* ===================== UI state helpers (loading / error / empty) ===================== */
function showLoading(message = "Loading weather…") {
  weatherEl.classList.add("hidden");
  statusEl.className = "panel state";
  statusEl.innerHTML = `<div class="spinner"></div><p>${message}</p>`;
}
function showError(message) {
  weatherEl.classList.add("hidden");
  statusEl.className = "panel state error";
  statusEl.innerHTML = `<p>⚠️ ${message}</p><br><button class="btn" id="retryBtn">Try again</button>`;
  $("retryBtn").addEventListener("click", () => loadWeather(state.city || DEFAULT_CITY));
}
function showEmpty(message) {
  weatherEl.classList.add("hidden");
  statusEl.className = "panel state";
  statusEl.innerHTML = `<p>🔍 ${message}</p>`;
}
function hideStatus() { statusEl.className = "panel state hidden"; }

/* ===================== API: city search ===================== */
async function searchCities(query) {
  showLoading("Searching cities…");
  resultsEl.classList.add("hidden");
  try {
    const res = await fetch(`${GEO_URL}?name=${encodeURIComponent(query)}&count=6&language=en&format=json`);
    if (!res.ok) throw new Error(`Search failed (HTTP ${res.status})`);
    const json = await res.json();
    const cities = json.results || [];

    if (cities.length === 0) {
      showEmpty(`No cities found for "${query}". Check the spelling and try again.`);
      return;
    }
    hideStatus();
    if (state.data) weatherEl.classList.remove("hidden");
    renderSearchResults(cities);
  } catch (err) {
    showError(err.message.includes("Failed to fetch")
      ? "Network error. Please check your internet connection."
      : err.message);
  }
}

/* ===================== API: weather ===================== */
async function loadWeather(city) {
  showLoading(`Loading weather for ${city.name}…`);
  const params = new URLSearchParams({
    latitude: city.latitude,
    longitude: city.longitude,
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,wind_speed_10m_max",
    timezone: "auto",
    forecast_days: 7
  });
  try {
    const res = await fetch(`${WEATHER_URL}?${params}`);
    if (!res.ok) throw new Error(`Weather service error (HTTP ${res.status})`);
    const data = await res.json();
    if (!data.daily || !data.daily.time || data.daily.time.length === 0) {
      showEmpty("No forecast data is available for this location.");
      return;
    }

    state.city = city;
    state.data = data;
    // Turn the parallel arrays from the API into an array of day objects using map()
    state.days = data.daily.time.map((date, i) => ({
      date,
      code: data.daily.weather_code[i],
      max: data.daily.temperature_2m_max[i],
      min: data.daily.temperature_2m_min[i],
      rain: data.daily.precipitation_probability_max[i] ?? 0,
      wind: data.daily.wind_speed_10m_max[i],
      sunrise: data.daily.sunrise[i],
      sunset: data.daily.sunset[i]
    }));
    state.selectedDate = null;

    saveToStorage("sky_lastCity", city);   // Local Storage: remember last city
    hideStatus();
    weatherEl.classList.remove("hidden");
    renderCurrent();
    renderForecast();
    renderFavorites();
  } catch (err) {
    showError(err.message.includes("Failed to fetch")
      ? "Network error. Please check your internet connection."
      : err.message);
  }
}

/* ===================== Rendering ===================== */
function renderSearchResults(cities) {
  resultsEl.innerHTML = "";
  cities.forEach((c) => {
    const li = document.createElement("li");
    const region = [c.admin1, c.country].filter(Boolean).join(", ");
    li.innerHTML = `<strong></strong> <small></small>`;
    li.querySelector("strong").textContent = c.name;
    li.querySelector("small").textContent = region;
    li.addEventListener("click", () => {
      resultsEl.classList.add("hidden");
      searchInput.value = "";
      loadWeather({ name: c.name, country: c.country || "", latitude: c.latitude, longitude: c.longitude });
    });
    resultsEl.appendChild(li);
  });
  resultsEl.classList.remove("hidden");
}

function renderCurrent() {
  const cur = state.data.current;
  const [desc, icon] = describe(cur.weather_code);
  const isFav = state.favorites.some((f) => sameCity(f, state.city));
  currentPanel.innerHTML = `
    <div class="current">
      <div>
        <div class="place"></div>
        <div class="muted">${desc}</div>
        <div class="temp">${toUnit(cur.temperature_2m)}${unitLabel()}</div>
      </div>
      <div class="icon">${icon}</div>
      <button class="btn ${isFav ? "active" : ""}" id="favBtn">${isFav ? "★ Saved" : "☆ Save city"}</button>
    </div>
    <div class="stats">
      <div class="stat"><span>Feels like</span>${toUnit(cur.apparent_temperature)}${unitLabel()}</div>
      <div class="stat"><span>Humidity</span>${cur.relative_humidity_2m}%</div>
      <div class="stat"><span>Wind</span>${cur.wind_speed_10m} km/h</div>
      <div class="stat"><span>Today's range</span>${toUnit(state.days[0].min)}° / ${toUnit(state.days[0].max)}°</div>
    </div>`;
  currentPanel.querySelector(".place").textContent = cityKey(state.city);
  $("favBtn").addEventListener("click", toggleFavorite);
}

function getFilteredDays() {
  // filter() chooses which forecast days to display
  switch (state.filter) {
    case "rain": return state.days.filter((d) => d.rain >= 50);
    case "warm": return state.days.filter((d) => d.max >= 30);
    case "cool": return state.days.filter((d) => d.max <= 20);
    default: return state.days;
  }
}

function renderForecast() {
  const list = getFilteredDays();
  forecastEl.innerHTML = "";
  detailEl.classList.add("hidden");

  if (list.length === 0) {
    forecastEl.innerHTML = `<p class="muted">No days match this filter. Try another one.</p>`;
    return;
  }

  list.forEach((day) => {
    const index = state.days.findIndex((d) => d.date === day.date);
    const [desc, icon] = describe(day.code);
    const el = document.createElement("div");
    el.className = "day" + (day.date === state.selectedDate ? " selected" : "");
    el.innerHTML = `
      <div class="muted">${formatDay(day.date, index)}</div>
      <div class="icon">${icon}</div>
      <div class="hi">${toUnit(day.max)}${unitLabel()}</div>
      <div class="lo">${toUnit(day.min)}${unitLabel()}</div>
      <div class="muted">💧 ${day.rain}%</div>`;
    el.title = desc;
    el.addEventListener("click", () => selectDay(day.date));
    forecastEl.appendChild(el);
  });

  if (state.selectedDate) showDayDetail(state.selectedDate);
}

function selectDay(date) {
  state.selectedDate = date;
  // highlight selected card
  [...forecastEl.children].forEach((el) => el.classList.remove("selected"));
  renderForecast();
}

function showDayDetail(date) {
  const day = state.days.find((d) => d.date === date);   // find() selects one item
  if (!day) return;
  const index = state.days.indexOf(day);
  const [desc, icon] = describe(day.code);
  const time = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  detailEl.innerHTML = `
    <h2>${icon} ${formatDay(day.date, index)} — ${desc}</h2>
    <p>High <strong>${toUnit(day.max)}${unitLabel()}</strong> • Low <strong>${toUnit(day.min)}${unitLabel()}</strong></p>
    <p>Chance of rain: <strong>${day.rain}%</strong> • Max wind: <strong>${day.wind} km/h</strong></p>
    <p>🌅 Sunrise ${time(day.sunrise)} • 🌇 Sunset ${time(day.sunset)}</p>`;
  detailEl.classList.remove("hidden");
}

function renderFavorites() {
  favoritesEl.innerHTML = "";
  if (state.favorites.length === 0) {
    favoritesEl.innerHTML = `<span class="muted">No favorites yet. Search for a city and press "Save city".</span>`;
    return;
  }
  state.favorites.forEach((fav) => {
    const chip = document.createElement("span");
    chip.className = "btn chip" + (state.city && sameCity(fav, state.city) ? " active" : "");
    const label = document.createElement("span");
    label.textContent = fav.name;
    label.addEventListener("click", () => loadWeather(fav));
    const remove = document.createElement("span");
    remove.className = "remove";
    remove.textContent = "×";
    remove.title = "Remove";
    remove.addEventListener("click", (e) => {
      e.stopPropagation();
      removeFavorite(fav);
    });
    chip.append(label, remove);
    favoritesEl.appendChild(chip);
  });
}

/* ===================== Favorites (Local Storage) ===================== */
function toggleFavorite() {
  const exists = state.favorites.some((f) => sameCity(f, state.city));
  state.favorites = exists
    ? state.favorites.filter((f) => !sameCity(f, state.city))
    : [...state.favorites, state.city];
  saveToStorage("sky_favorites", state.favorites);
  renderFavorites();
  renderCurrent();
}
function removeFavorite(city) {
  state.favorites = state.favorites.filter((f) => !sameCity(f, city));
  saveToStorage("sky_favorites", state.favorites);
  renderFavorites();
  if (state.data) renderCurrent();
}

/* ===================== Event listeners ===================== */
searchForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const q = searchInput.value.trim();
  if (!q) {
    showEmpty("Please type a city name to search.");
    return;
  }
  searchCities(q);
});

filtersEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-filter]");
  if (!btn) return;
  state.filter = btn.dataset.filter;
  filtersEl.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b === btn));
  renderForecast();
});

document.querySelectorAll("button[data-unit]").forEach((btn) => {
  btn.addEventListener("click", () => {
    state.unit = btn.dataset.unit;
    saveToStorage("sky_unit", state.unit);          // Local Storage: remember unit
    updateUnitButtons();
    if (state.data) { renderCurrent(); renderForecast(); }
  });
});

function updateUnitButtons() {
  document.querySelectorAll("button[data-unit]").forEach((b) =>
    b.classList.toggle("active", b.dataset.unit === state.unit));
}

/* ===================== Init ===================== */
(function init() {
  // Restore saved data after page refresh
  state.unit = loadFromStorage("sky_unit", "C");
  state.favorites = loadFromStorage("sky_favorites", []);
  const lastCity = loadFromStorage("sky_lastCity", DEFAULT_CITY);

  updateUnitButtons();
  renderFavorites();
  loadWeather(lastCity);
})();
