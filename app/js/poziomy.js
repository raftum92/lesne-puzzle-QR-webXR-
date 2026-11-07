// Poziomy trudności. Im trudniej, tym więcej elementów i mniej podpowiedzi na planszy.
//
// ghost: widoczność obrazka-podpowiedzi na planszy (0 = brak), mono: podpowiedź bez kolorów
// hints: miejsce na planszy świeci się, gdy niesiony element jest blisko niego
// snap:  promień przyciągania jako ułamek krótszego boku elementu

export const LEVELS = {
  latwy: { id: "latwy", name: "Łatwy", cols: 3, rows: 2, ghost: 0.3, mono: false, hints: true, snap: 0.42 },
  sredni: { id: "sredni", name: "Średni", cols: 4, rows: 3, ghost: 0.14, mono: true, hints: true, snap: 0.36 },
  trudny: { id: "trudny", name: "Trudny", cols: 6, rows: 4, ghost: 0.14, mono: true, hints: false, snap: 0.32 },
};

export const LEVEL_ORDER = ["latwy", "sredni", "trudny"];

export function pieceCount(level) {
  return level.cols * level.rows;
}

// „6 elementów”, „24 elementy”, „1 element”
export function piecesLabel(count) {
  const tens = count % 100;
  const ones = count % 10;
  if (count === 1) return "1 element";
  if (ones >= 2 && ones <= 4 && (tens < 12 || tens > 14)) return `${count} elementy`;
  return `${count} elementów`;
}
