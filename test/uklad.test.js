import { test } from "node:test";
import assert from "node:assert/strict";
import { LEVELS } from "../app/js/poziomy.js";
import {
  BOARD_METERS,
  BOARD_H,
  FRAME_SCALE,
  THICKNESS,
  LIFT,
  GRAB,
  DRAG_MARGIN,
  HOME_MARGIN,
  HOME_SPREAD,
  TILT,
  cellSize,
  targetOf,
  planHomes,
  pickPiece,
  clampToArea,
  shouldSnap,
  isNear,
  intersectBoard,
} from "../app/js/ar/uklad.js";

const H = 9 / 16;

test("stałe mają wartości ze specyfikacji", () => {
  assert.deepEqual(BOARD_METERS, { stol: 0.5, podloga: 1.2 });
  assert.equal(BOARD_H, H);
  assert.equal(FRAME_SCALE, 1.5);
  assert.equal(THICKNESS, 0.012);
  assert.equal(LIFT, 0.03);
  assert.equal(GRAB, 0.75);
  assert.equal(DRAG_MARGIN, 0.7);
  assert.equal(HOME_MARGIN, 0.04);
  assert.equal(HOME_SPREAD, 0.45);
  assert.equal(TILT, (9 * Math.PI) / 180);
});

test("cellSize i targetOf liczą w jednostkach planszy", () => {
  const { cw, ch, size } = cellSize(LEVELS.latwy);
  assert.equal(cw, 1 / 3);
  assert.equal(ch, H / 2);
  assert.equal(size, H / 2);
  assert.deepEqual(targetOf(1, 2, LEVELS.latwy), { x: 2.5 * cw, z: 1.5 * ch });
});

for (const level of Object.values(LEVELS)) {
  test(`${level.id}: elementy leżą poza planszą, nie za nią i bez nachodzenia`, () => {
    const { cw, ch, size } = cellSize(level);
    const homes = planHomes(level);
    assert.equal(homes.length, level.cols * level.rows);
    for (const { x, z, rot } of homes) {
      const outside =
        x + cw / 2 <= -HOME_MARGIN + 1e-9 || x - cw / 2 >= 1 + HOME_MARGIN - 1e-9 || z - ch / 2 >= H + HOME_MARGIN - 1e-9;
      assert.ok(outside, "na planszy");
      assert.ok(z - ch / 2 >= -1e-9, "za planszą");
      assert.ok(x - cw / 2 >= -HOME_MARGIN - HOME_SPREAD - 1e-9 && x + cw / 2 <= 1 + HOME_MARGIN + HOME_SPREAD + 1e-9, "poza pasem");
      assert.ok(z + ch / 2 <= H + HOME_MARGIN + HOME_SPREAD + 1e-9, "poza pasem");
      assert.ok(Math.abs(rot) <= TILT);
    }
    for (const a of homes) {
      for (const b of homes) {
        if (a !== b) assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= size);
      }
    }
  });
}

test("planHomes jest losowe", () => {
  const first = JSON.stringify(planHomes(LEVELS.trudny));
  const second = JSON.stringify(planHomes(LEVELS.trudny));
  assert.notEqual(first, second);
});

test("pickPiece bierze najbliższy nieułożony w promieniu chwytu", () => {
  const level = LEVELS.latwy; // GRAB × dłuższy bok = 0,75 × 1/3 = 0,25
  const near = { r: 0, c: 0, x: 0.1, z: 0, placed: false };
  const far = { r: 0, c: 1, x: 0.2, z: 0, placed: false };
  const done = { r: 0, c: 2, x: 0.01, z: 0, placed: true };
  assert.equal(pickPiece([far, near, done], { x: 0, z: 0 }, level), near);
  assert.equal(pickPiece([near], { x: 0.36, z: 0 }, level), null);
});

test("shouldSnap i isNear używają promieni z LEVELS", () => {
  const level = LEVELS.trudny;
  const { size } = cellSize(level);
  const piece = { r: 1, c: 1 };
  const t = targetOf(1, 1, level);
  assert.equal(shouldSnap(piece, { x: t.x + level.snap * size * 0.99, z: t.z }, level), true);
  assert.equal(shouldSnap(piece, { x: t.x + level.snap * size * 1.01, z: t.z }, level), false);
  assert.equal(isNear(piece, { x: t.x + level.snap * size * 1.59, z: t.z }, level), true);
  assert.equal(isNear(piece, { x: t.x + level.snap * size * 1.61, z: t.z }, level), false);
});

test("clampToArea zatrzymuje punkt na granicy obszaru", () => {
  assert.deepEqual(clampToArea({ x: 5, z: -5 }), { x: 1 + DRAG_MARGIN, z: -DRAG_MARGIN });
  assert.deepEqual(clampToArea({ x: -5, z: 5 }), { x: -DRAG_MARGIN, z: H + DRAG_MARGIN });
  assert.deepEqual(clampToArea({ x: 0.5, z: 0.2 }), { x: 0.5, z: 0.2 });
});

test("intersectBoard: promień w dół trafia, a prawie poziomy nie", () => {
  assert.deepEqual(intersectBoard({ x: 0, y: 1, z: 0 }, { x: 0, y: -1, z: 0 }), { x: 0, z: 0 });
  assert.deepEqual(intersectBoard({ x: 0, y: 2, z: 0 }, { x: 1, y: -1, z: 0.5 }), { x: 2, z: 1 });
  assert.equal(intersectBoard({ x: 0, y: 1, z: 0 }, { x: 0, y: 0.2, z: 1 }), null);
  assert.equal(intersectBoard({ x: 0, y: 1, z: 0 }, { x: 0, y: -0.01, z: 1 }), null);
  assert.equal(intersectBoard({ x: 0, y: -1, z: 0 }, { x: 0, y: -1, z: 0 }), null);
});
