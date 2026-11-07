// Czy można włączyć tryb „W pokoju”. Ten moduł nie ładuje Three.js, więc nie spowalnia zwykłej gry.

// Zwraca "xr" na urządzeniu z AR, "symulacja" w symulatorze na tym komputerze albo null.
export async function detectAr({ location, navigator }) {
  const local = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  if (local && new URLSearchParams(location.search).get("ar") === "symulacja") return "symulacja";
  try {
    return (await navigator.xr?.isSessionSupported("immersive-ar")) ? "xr" : null;
  } catch {
    return null; // na przykład strona bez HTTPS
  }
}
