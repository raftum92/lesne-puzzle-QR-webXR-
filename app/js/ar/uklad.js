// Logika planszy w trybie AR, bez Three.js i bez DOM.
// Jednostki planszy: szerokość 1, wysokość 9/16, początek w lewym dalszym rogu, oś x w prawo, oś z do gracza.
// Na metry przelicza to skala grupy z planszą.

export const BOARD_METERS = { stol: 0.5, podloga: 1.2 };
export const BOARD_H = 9 / 16;
export const FRAME_SCALE = 1.5; // ile razy rama jest szersza od planszy
export const THICKNESS = 0.012; // grubość elementu
export const LIFT = 0.03; // wysokość niesionego elementu
export const GRAB = 0.75; // promień chwytu jako ułamek dłuższego boku komórki
export const DRAG_MARGIN = 0.7; // jak daleko poza planszę można wynieść element
export const HOME_MARGIN = 0.04; // odstęp rozsypanych elementów od planszy
export const HOME_SPREAD = 0.45; // szerokość pasa, w którym leżą rozsypane elementy
export const TILT = (9 * Math.PI) / 180; // największy obrót rozsypanego elementu, jak w puzzle.js

const PITCH = 1.05; // odstęp między rozsypanymi elementami względem wielkości komórki
const NEAR_FACTOR = 1.6; // w jakim promieniu świeci miejsce, jak markNear w puzzle.js
const MIN_DOWN = 0.05; // promień prawie równoległy do podłogi trafiłby bardzo daleko, więc go pomijamy

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export function cellSize(level) {
  const cw = 1 / level.cols;
  const ch = BOARD_H / level.rows;
  return { cw, ch, size: Math.min(cw, ch) };
}

// Środek komórki (r, c) na planszy.
export function targetOf(r, c, level) {
  const { cw, ch } = cellSize(level);
  return { x: (c + 0.5) * cw, z: (r + 0.5) * ch };
}

// Miejsca rozsypanych elementów: po bokach i przed planszą. Za planszą ich nie ma, bo tam najtrudniej sięgnąć.
export function planHomes(level, random = Math.random) {
  const { cw, ch } = cellSize(level);
  const px = cw * PITCH;
  const pz = ch * PITCH;
  const outer = HOME_MARGIN + HOME_SPREAD;
  const spots = [];
  for (let x = -(HOME_MARGIN + cw / 2); x - cw / 2 >= -outer; x -= px) {
    for (let z = ch / 2; z + ch / 2 <= BOARD_H + outer; z += pz) {
      spots.push({ x, z }, { x: 1 - x, z });
    }
  }
  for (let z = BOARD_H + HOME_MARGIN + ch / 2; z + ch / 2 <= BOARD_H + outer; z += pz) {
    for (let x = cw / 2; x + cw / 2 <= 1; x += px) spots.push({ x, z });
  }
  for (let i = spots.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [spots[i], spots[j]] = [spots[j], spots[i]];
  }
  return spots.slice(0, level.cols * level.rows).map((spot) => ({ ...spot, rot: (random() * 2 - 1) * TILT }));
}

// Najbliższy nieułożony element w promieniu chwytu. Palec jest gruby, więc nie trzeba trafić dokładnie.
export function pickPiece(pieces, point, level) {
  const { cw, ch } = cellSize(level);
  let best = null;
  let bestDistance = GRAB * Math.max(cw, ch);
  for (const piece of pieces) {
    if (piece.placed) continue;
    const d = distance(piece, point);
    if (d <= bestDistance) {
      best = piece;
      bestDistance = d;
    }
  }
  return best;
}

export function clampToArea({ x, z }) {
  return { x: clamp(x, -DRAG_MARGIN, 1 + DRAG_MARGIN), z: clamp(z, -DRAG_MARGIN, BOARD_H + DRAG_MARGIN) };
}

function distanceToTarget(piece, point, level) {
  return distance(targetOf(piece.r, piece.c, level), point);
}

export function shouldSnap(piece, point, level) {
  return distanceToTarget(piece, point, level) < level.snap * cellSize(level).size;
}

export function isNear(piece, point, level) {
  return distanceToTarget(piece, point, level) < NEAR_FACTOR * level.snap * cellSize(level).size;
}

// Punkt, w którym promień trafia w płaszczyznę planszy (y = 0), albo null, gdy nie trafia.
export function intersectBoard(origin, direction) {
  const length = Math.hypot(direction.x, direction.y, direction.z);
  if (origin.y <= 0 || direction.y > -MIN_DOWN * length) return null;
  const t = -origin.y / direction.y;
  return { x: origin.x + direction.x * t, z: origin.z + direction.z * t };
}
