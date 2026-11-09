// Logika planszy w trybie AR, bez Three.js i bez DOM.
// Jednostki planszy: szerokość 1, wysokość 9/16, początek w lewym dalszym rogu, oś x w prawo, oś z do gracza.
// Na metry przelicza to skala grupy z planszą. W trybie W przestrzeni plansza wisi przed graczem, zwrócona do niego
// (boardPose, aimSpot): oś z idzie wtedy mniej więcej w dół, a oś y do gracza, więc „przed planszą” znaczy „pod nią”.

export const BOARD_METERS = { mala: 0.5, duza: 1 };
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
const AIM_ROOM = 1.1; // zapas wokół planszy z elementami w kadrze
const AIM_MIN_LEVEL = 0.2; // telefon skierowany prawie pionowo: kierunek w poziomie byłby przypadkowy
const MIN_DOWN = 0.05; // promień prawie równoległy do planszy trafiłby bardzo daleko, więc go pomijamy
const FRONT_PITCH = 1.08; // odstęp elementów w siatce pod planszą względem wielkości komórki
// Dolna krawędź siatki elementów pod planszą (planFrontHomes), z zapasem na każdy poziom: rows * ch = BOARD_H.
const FRONT_BOTTOM = BOARD_H * (1 + FRONT_PITCH) + HOME_MARGIN;
// Punkt, wokół którego wisząca plansza obraca się do telefonu: środek całości z elementami pod planszą.
export const UPRIGHT_PIVOT = FRONT_BOTTOM / 2;
const FIXED_FOV = 50;
const FIXED_TILT = (20 * Math.PI) / 180; // odchylenie od pionu: plansza wygląda, jakby leżała przed graczem
// Wymiary widoku z zapasem na perspektywę, górny pasek i podpowiedź; z to środek widoku na planszy.
const FRONT_VIEW = { width: 1.3, height: 1.75, z: 0.6 };
const WIDE_VIEW = { width: 2.3, height: 1.6, z: 0.55 };
// Stojąca rama ma szerokość około 1,6, a film ze skokiem wysokość około 3,2 wokół środka obrazu.
const STANDING_VIEW = { width: 1.75, height: 3.3, y: 0.48, lift: 0.15 };

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
  return scatter(spots, level, random);
}

// Układ na pionowy ekran bez chodzenia z telefonem: elementy leżą w siatce pod planszą, żeby plansza mogła być duża.
export function planFrontHomes(level, random = Math.random) {
  const { cw, ch } = cellSize(level);
  const px = cw * FRONT_PITCH;
  const pz = ch * FRONT_PITCH;
  const spots = [];
  for (let r = 0; r < level.rows; r++) {
    for (let c = 0; c < level.cols; c++) {
      spots.push({ x: 0.5 + (c - (level.cols - 1) / 2) * px, z: BOARD_H + HOME_MARGIN + ch / 2 + r * pz });
    }
  }
  return scatter(spots, level, random);
}

function scatter(spots, level, random) {
  for (let i = spots.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [spots[i], spots[j]] = [spots[j], spots[i]];
  }
  return spots.slice(0, level.cols * level.rows).map((spot) => ({ ...spot, rot: (random() * 2 - 1) * TILT }));
}

// Kamera sceny, kiedy gracz nie chodzi z telefonem: wszystko ma się mieścić w oknie o danych proporcjach.
// Współrzędne planszy. „lying” to widok z góry na planszę i elementy, „standing” naprzeciw stojącej ramy.
export function fixedView(aspect, frontHomes) {
  const span = 2 * Math.tan((FIXED_FOV * Math.PI) / 360);
  const distance = (width, height) => Math.max(width / (span * aspect), height / span);
  const area = frontHomes ? FRONT_VIEW : WIDE_VIEW;
  const lying = distance(area.width, area.height);
  const standing = distance(STANDING_VIEW.width, STANDING_VIEW.height);
  return {
    fov: FIXED_FOV,
    lying: {
      target: { x: 0.5, y: 0, z: area.z },
      position: { x: 0.5, y: lying * Math.cos(FIXED_TILT), z: area.z + lying * Math.sin(FIXED_TILT) },
    },
    standing: {
      target: { x: 0.5, y: STANDING_VIEW.y, z: 0 },
      position: { x: 0.5, y: STANDING_VIEW.y + STANDING_VIEW.lift, z: standing },
    },
  };
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

// Położenie planszy względem wybranego punktu, w jednostkach planszy. `tilt` to obrót wokół osi x: 0 to plansza leżąca,
// π/2 stojąca pionowo przodem do gracza, a pomiędzy odchylona do tyłu jak pulpit. Punkt planszy (0,5; 0; pivotZ)
// zostaje w wybranym miejscu przy każdym nachyleniu; `lift` i `back` to przesunięcie obracanej grupy.
export function boardPose(tilt, pivotZ) {
  return { tilt, lift: pivotZ * Math.sin(tilt), back: -pivotZ * Math.cos(tilt), offset: { x: -0.5, z: 0 } };
}

// Nachylenie, przy którym przód planszy w `position` patrzy prosto na telefon w `eye`.
export function facingTilt(eye, position) {
  return Math.PI / 2 - Math.atan2(eye.y - position.y, Math.hypot(eye.x - position.x, eye.z - position.z));
}

// Miejsce wiszącej planszy przed telefonem: `eye` to pozycja telefonu, `forward` kierunek kamery, a `tanHalfFov`
// i `tanHalfFovY` to tangensy połowy kąta widzenia w poziomie i w pionie. Elementy leżą w siatce pod planszą
// (planFrontHomes), bo telefon w pionie widzi w poziomie tylko około 33°: z elementami po bokach plansza wisiałaby
// kilka metrów dalej. Środek całości (UPRIGHT_PIVOT) jest tam, gdzie celuje telefon, tak blisko, żeby mała plansza
// z elementami mieściła się w kadrze, a plansza jest prostopadle do linii celowania. Duża wisi w tym samym miejscu,
// więc jest na ekranie większa i wychodzi poza kadr. Zwraca null, gdy telefon patrzy prawie pionowo.
export function aimSpot(eye, forward, tanHalfFov, tanHalfFovY = Infinity) {
  const length = Math.hypot(forward.x, forward.y, forward.z);
  if (Math.hypot(forward.x, forward.z) < AIM_MIN_LEVEL * length) return null;
  const halfWidth = (FRONT_PITCH / 2) * BOARD_METERS.mala;
  const halfHeight = (FRONT_BOTTOM / 2) * BOARD_METERS.mala;
  const k = (AIM_ROOM * Math.max(halfWidth / tanHalfFov, halfHeight / tanHalfFovY)) / length;
  const position = { x: eye.x + forward.x * k, y: eye.y + forward.y * k, z: eye.z + forward.z * k };
  return { position, yaw: Math.atan2(eye.x - position.x, eye.z - position.z), tilt: facingTilt(eye, position) };
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
