/* ============================================
   WEATHERGLASS
   A tiny weather app powered by Open-Meteo
   (free, no API key required: https://open-meteo.com)
   ============================================ */

// --- Grab the DOM elements we'll need to update ---
const form = document.getElementById("search-form");
const input = document.getElementById("city-input");
const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");

const cityNameEl = document.getElementById("city-name");
const countryNameEl = document.getElementById("country-name");
const iconEl = document.getElementById("icon");
const temperatureEl = document.getElementById("temperature");
const conditionEl = document.getElementById("condition");
const feelsLikeEl = document.getElementById("feels-like");
const humidityEl = document.getElementById("humidity");
const windEl = document.getElementById("wind");
const updatedEl = document.getElementById("updated");

// --- WMO weather codes -> human-readable text + a simple SVG icon ---
// Open-Meteo returns a numeric "weather_code" following the WMO standard.
// Full table: https://open-meteo.com/en/docs
const WEATHER_CODES = {
  0: { label: "Clear sky", icon: "sun" },
  1: { label: "Mostly clear", icon: "sun" },
  2: { label: "Partly cloudy", icon: "cloud-sun" },
  3: { label: "Overcast", icon: "cloud" },
  45: { label: "Fog", icon: "fog" },
  48: { label: "Depositing rime fog", icon: "fog" },
  51: { label: "Light drizzle", icon: "rain" },
  53: { label: "Drizzle", icon: "rain" },
  55: { label: "Dense drizzle", icon: "rain" },
  61: { label: "Light rain", icon: "rain" },
  63: { label: "Rain", icon: "rain" },
  65: { label: "Heavy rain", icon: "rain" },
  71: { label: "Light snow", icon: "snow" },
  73: { label: "Snow", icon: "snow" },
  75: { label: "Heavy snow", icon: "snow" },
  80: { label: "Rain showers", icon: "rain" },
  81: { label: "Rain showers", icon: "rain" },
  82: { label: "Violent rain showers", icon: "rain" },
  95: { label: "Thunderstorm", icon: "storm" },
  96: { label: "Thunderstorm with hail", icon: "storm" },
  99: { label: "Thunderstorm with hail", icon: "storm" },
};

// A small set of hand-drawn line icons, so we don't depend on any image files.
const ICONS = {
  sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8L6 18M18 6l1.8-1.8" stroke-linecap="round"/></svg>`,
  "cloud-sun": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8" cy="9" r="3.2"/><path d="M8 3.5v1.4M13.7 9.2l-1 1M3.3 9.2l1 1" stroke-linecap="round"/><path d="M7 20h10.5a3.5 3.5 0 0 0 .5-6.96A5 5 0 0 0 8.6 12.2 3.5 3.5 0 0 0 7 20Z"/></svg>`,
  cloud: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6.5 19h11a4 4 0 0 0 .4-7.98A5.5 5.5 0 0 0 7.3 10 4 4 0 0 0 6.5 19Z"/></svg>`,
  fog: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 9h13M4 13.5h16M4 18h11"/></svg>`,
  rain: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6.5 15H16a4 4 0 0 0 .4-7.98A5.5 5.5 0 0 0 6.3 8 3.5 3.5 0 0 0 6.5 15Z"/><path d="M8 18.5l-1 2M12 18.5l-1 2M16 18.5l-1 2" stroke-linecap="round"/></svg>`,
  snow: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6.5 14H16a4 4 0 0 0 .4-7.98A5.5 5.5 0 0 0 6.3 7 3.5 3.5 0 0 0 6.5 14Z"/><path d="M9 18v3M9 18l-1.6 1M9 18l1.6 1M15 18v3M15 18l-1.6 1M15 18l1.6 1" stroke-linecap="round"/></svg>`,
  storm: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6.5 13H15a4 4 0 0 0 .4-7.98A5.5 5.5 0 0 0 6.3 6 3.5 3.5 0 0 0 6.5 13Z"/><path d="M13 14l-2.5 4h2.5l-2 4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};

// --- UI state helpers ---
function showStatus(message, isError = false) {
  resultEl.hidden = true;
  statusEl.hidden = false;
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

function showResult() {
  statusEl.hidden = true;
  resultEl.hidden = false;
}

// --- Step 1: turn a city name into coordinates (geocoding) ---
async function geocodeCity(city) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    city
  )}&count=1&language=en&format=json`;

  const response = await fetch(url);
  if (!response.ok) throw new Error("Geocoding request failed");

  const data = await response.json();
  if (!data.results || data.results.length === 0) {
    throw new Error(`Couldn't find "${city}". Try a different spelling.`);
  }

  const { latitude, longitude, name, country } = data.results[0];
  return { latitude, longitude, name, country };
}

// --- Step 2: fetch current weather for those coordinates ---
async function fetchWeather(latitude, longitude) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code` +
    `&timezone=auto`;

  const response = await fetch(url);
  if (!response.ok) throw new Error("Weather request failed");

  const data = await response.json();
  return data.current;
}

// --- Step 3: paint the result onto the page ---
function renderWeather(place, current) {
  const weatherInfo = WEATHER_CODES[current.weather_code] || {
    label: "Unknown",
    icon: "cloud",
  };

  cityNameEl.textContent = place.name;
  countryNameEl.textContent = place.country ? `, ${place.country}` : "";

  iconEl.innerHTML = ICONS[weatherInfo.icon];
  temperatureEl.textContent = Math.round(current.temperature_2m);
  conditionEl.textContent = weatherInfo.label;

  feelsLikeEl.textContent = `${Math.round(current.apparent_temperature)}°`;
  humidityEl.textContent = `${Math.round(current.relative_humidity_2m)}%`;
  windEl.textContent = `${Math.round(current.wind_speed_10m)} km/h`;

  const time = new Date(current.time);
  updatedEl.textContent = `Updated ${time.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;

  showResult();
}

// --- Tie it all together ---
async function searchCity(city) {
  showStatus("Reading the sky…");
  try {
    const place = await geocodeCity(city);
    const current = await fetchWeather(place.latitude, place.longitude);
    renderWeather(place, current);
  } catch (err) {
    showStatus(err.message || "Something went wrong. Please try again.", true);
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const city = input.value.trim();
  if (city) searchCity(city);
});

// --- Load a default city on first visit so the panel isn't empty ---
searchCity("London");
