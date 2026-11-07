// Postęp gracza w pamięci przeglądarki: wybrany poziom, wyciszenie i ułożone obrazki z rekordami.
// Prywatne okno albo zablokowana pamięć nie mogą zepsuć gry, więc każdy dostęp jest w try/catch.

const KEY = "lesne-puzzle:v1";

const empty = () => ({ level: "latwy", muted: false, mode: "ekran", done: {} });

export class Progress {
  constructor() {
    this.data = empty();
    try {
      const saved = JSON.parse(localStorage.getItem(KEY));
      if (saved && typeof saved === "object") this.data = { ...empty(), ...saved };
      if (!this.data.done || typeof this.data.done !== "object") this.data.done = {};
    } catch {
      // brak dostępu do pamięci: gramy bez zapisywania
    }
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      // jak wyżej
    }
  }

  get level() {
    return this.data.level;
  }

  set level(level) {
    this.data.level = level;
    this.save();
  }

  get muted() {
    return this.data.muted;
  }

  set muted(muted) {
    this.data.muted = muted;
    this.save();
  }

  // Tryb gry: "ekran" albo "pokoj". Zepsuty zapis liczy się jako ekran.
  get mode() {
    return this.data.mode === "pokoj" ? "pokoj" : "ekran";
  }

  set mode(mode) {
    this.data.mode = mode;
    this.save();
  }

  best(animal, level) {
    return this.data.done[animal]?.[level]?.best ?? null;
  }

  isDone(animal, level) {
    return this.best(animal, level) !== null;
  }

  // Zapisuje ułożony obrazek. Zwraca, czy to pierwsze ułożenie na tym poziomie i czy padł rekord.
  record(animal, level, seconds) {
    const previous = this.best(animal, level);
    const first = previous === null;
    const record = !first && seconds < previous;
    this.data.done[animal] ??= {};
    this.data.done[animal][level] = { best: first || record ? seconds : previous };
    this.save();
    return { first, record, best: this.data.done[animal][level].best };
  }

  count(animals, levels) {
    let n = 0;
    for (const animal of animals) for (const level of levels) if (this.isDone(animal, level)) n++;
    return n;
  }

  reset() {
    this.data = { ...empty(), level: this.data.level, muted: this.data.muted, mode: this.data.mode };
    this.save();
  }
}

// Zapisany tryb „W pokoju” działa tylko tam, gdzie jest AR.
export function resolveMode(saved, arSupport) {
  return saved === "pokoj" && arSupport ? "pokoj" : "ekran";
}

// 0:42, 1:05, 12:30
export function formatTime(seconds) {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
