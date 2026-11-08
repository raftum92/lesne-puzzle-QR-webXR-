// Skok zwierzęcia z ramy w trybie „W przestrzeni”: pionowy film na zielonym tle, które znika w shaderze (rama.js).

// Miejsce obrazu w filmie, jako ułamki kadru. Takie same we wszystkich filmach, bo klatkę startową składa
// narzedzia/rama.py, a Veo zostawia ramę tam, gdzie była.
export const JUMP_PICTURE = { x: 90 / 1080, y: 707 / 1920, w: 900 / 1080, h: 506 / 1920 };

// Usuwanie tła: tło znika tam, gdzie zieleń przewyższa czerwień i niebieski, od low do high (ułamki jasności).
// spill: o ile zieleń może przewyższać pozostałe kolory na krawędziach futra.
export const KEY = { low: 18 / 255, high: 50 / 255, spill: 6 / 255 };

// Przejście ze zwykłego filmu: skok rusza chwilę przed jego końcem i płynnie się pojawia. Gdyby czekał na koniec,
// obraz stałby przez kilka dziesiątych sekundy, a potem ostrość urywałaby się na sklejeniu.
export const JUMP_OVERLAP_S = 0.4;
export const JUMP_FADE_MS = 300;

export function jumpDue(currentTime, duration) {
  return Number.isFinite(duration) && currentTime >= duration - JUMP_OVERLAP_S;
}

// Skok jest zawsze włączony. Tylko systemowe ograniczenie ruchu kończy grę na zwykłym filmie.
export function canJump(animal, { reducedMotion }) {
  return Boolean(animal.jump && !reducedMotion);
}

// Wymiary płaszczyzny z filmem, przy których obraz z filmu ma szerokość obrazu w ramie.
export function jumpPlane(pictureWidth) {
  const width = pictureWidth / JUMP_PICTURE.w;
  return { width, height: (width * 16) / 9 };
}
