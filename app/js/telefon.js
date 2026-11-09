// „Ułóż w telefonie”: adres w kodzie QR, z którym telefon otwiera od razu wybrane zwierzę i poziom.
import { ANIMALS } from "./zwierzeta.js";
import { LEVELS } from "./poziomy.js";

// Opublikowana gra. Tam prowadzi kod QR z podglądu bez HTTPS: telefon nie otworzy cudzego `localhost`, a WebXR wymaga HTTPS.
export const PUBLIC_URL = "https://pomoceedukacyjne.pl/puzzle/app/";

export function phoneLink(animalId, levelId, { protocol, origin, pathname }) {
  const base = protocol === "https:" ? origin + pathname : PUBLIC_URL;
  return `${base}?zwierze=${animalId}&poziom=${levelId}`;
}

// Zwraca { animal, level } z adresu albo null, gdy adres nie wskazuje znanego zwierzęcia.
export function readPhoneLink(search) {
  const params = new URLSearchParams(search);
  const animal = params.get("zwierze");
  const level = params.get("poziom");
  if (!Object.hasOwn(ANIMALS, animal)) return null;
  return { animal, level: Object.hasOwn(LEVELS, level) ? level : "latwy" };
}

// Telefon albo tablet, a nie monitor na stanowisku. Ekran dotykowy tego nie rozstrzyga, bo monitor
// w centrum nauki też może być dotykowy, a wtedy ma pokazywać kod QR, a nie tryb z kamerą.
export function isHandheld({ userAgent = "", userAgentData, maxTouchPoints = 0, platform = "" }) {
  if (userAgentData?.mobile || /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent)) return true;
  return platform === "MacIntel" && maxTouchPoints > 1; // iPad, który przedstawia się jak Mac
}
