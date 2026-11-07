// „Ułóż w telefonie”: adres w kodzie QR, z którym telefon otwiera od razu wybrane zwierzę i poziom.
import { ANIMALS } from "./zwierzeta.js";
import { LEVELS } from "./poziomy.js";

// Opublikowana gra. Tam prowadzi kod QR z podglądu bez HTTPS: telefon nie otworzy cudzego `localhost`, a WebXR wymaga HTTPS.
export const PUBLIC_URL = "https://raftum92.github.io/lesne-puzzle-QR-webXR-/app/";

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

// Adres bez zwierzęcia i poziomu, żeby po odświeżeniu gra zaczynała się od ekranu tytułowego. Pozostałe parametry zostają.
export function withoutPhoneLink({ pathname, search }) {
  const params = new URLSearchParams(search);
  params.delete("zwierze");
  params.delete("poziom");
  const rest = params.toString();
  return pathname + (rest ? `?${rest}` : "");
}
