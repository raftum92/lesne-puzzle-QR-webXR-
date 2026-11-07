// Czy można włączyć tryb „W pokoju”. Ten moduł nie ładuje Three.js, więc nie spowalnia zwykłej gry.

// Zwraca "xr" na urządzeniu z AR, "kamera" na telefonie bez AR, ale z kamerą, "symulacja" w symulatorze na tym
// komputerze albo null. `touch` odróżnia telefon od komputera z kamerką, który gra na ekranie i pokazuje kod QR.
export async function detectAr({ location, navigator, touch = false }) {
  const local = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  const forced = local ? new URLSearchParams(location.search).get("ar") : null;
  if (forced === "symulacja" || forced === "kamera") return forced;
  try {
    if (await navigator.xr?.isSessionSupported("immersive-ar")) return "xr";
  } catch {
    // na przykład strona bez HTTPS; bez niego kamera też nie działa, więc niżej wyjdzie null
  }
  return touch && navigator.mediaDevices?.getUserMedia ? "kamera" : null;
}
