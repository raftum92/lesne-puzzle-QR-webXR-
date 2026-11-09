import { test } from "node:test";
import assert from "node:assert/strict";
import { LEVELS } from "../app/js/poziomy.js";
import { DRAG_MARGIN, targetOf } from "../app/js/ar/uklad.js";
import { Dragger } from "../app/js/ar/przeciaganie.js";

const level = LEVELS.latwy;
const ray = (x, z) => ({ origin: { x, y: 1, z }, direction: { x: 0, y: -1, z: 0 } });
const setup = (options = {}) => {
  const piece = { r: 0, c: 0, x: -0.3, z: 0.1, placed: false };
  const log = [];
  const dragger = new Dragger({
    pieces: [piece],
    level,
    toBoard: (r) => r,
    onPick: () => log.push("pick"),
    onMove: () => log.push("move"),
    onNear: (near) => log.push(near ? "near" : "far"),
    onSnap: () => log.push("snap"),
    onDrop: () => log.push("drop"),
    ...options,
  });
  return { piece, log, dragger };
};

test("chwyt zachowuje punkt pod palcem", () => {
  const { piece, dragger } = setup();
  dragger.pointer("down", ray(-0.25, 0.1), 1);
  dragger.pointer("move", ray(-0.15, 0.2), 1);
  assert.ok(Math.abs(piece.x - -0.2) < 1e-9);
  assert.ok(Math.abs(piece.z - 0.2) < 1e-9);
});

test("upuszczenie przy celu przyciąga do miejsca", () => {
  const { piece, log, dragger } = setup();
  const t = targetOf(0, 0, level);
  dragger.pointer("down", ray(-0.3, 0.1), 1);
  dragger.pointer("move", ray(t.x, t.z), 1);
  dragger.pointer("up", ray(t.x, t.z), 1);
  assert.deepEqual([piece.x, piece.z, piece.placed], [t.x, t.z, true]);
  assert.ok(log.includes("snap"));
});

test("upuszczenie daleko od celu zostawia element na miejscu", () => {
  const { piece, log, dragger } = setup();
  dragger.pointer("down", ray(-0.3, 0.1), 1);
  dragger.pointer("move", ray(-0.4, 0.3), 1);
  dragger.pointer("up", ray(-0.4, 0.3), 1);
  assert.equal(piece.placed, false);
  assert.ok(Math.abs(piece.x - -0.4) < 1e-9);
  assert.ok(log.includes("drop"));
  assert.ok(!log.includes("snap"));
});

test("koniec dotyku bez promienia nie psuje upuszczenia", () => {
  const { piece, log, dragger } = setup();
  const t = targetOf(0, 0, level);
  dragger.pointer("down", ray(-0.3, 0.1), 1);
  dragger.pointer("move", ray(t.x, t.z), 1);
  dragger.pointer("up", null, 1);
  assert.equal(piece.placed, true);
  assert.ok(log.includes("snap"));
});

test("drugi palec niczego nie zmienia", () => {
  const { piece, log, dragger } = setup();
  dragger.pointer("down", ray(-0.3, 0.1), 1);
  dragger.pointer("down", ray(-0.3, 0.1), 2);
  dragger.pointer("move", ray(5, 5), 2);
  dragger.pointer("up", ray(5, 5), 2);
  assert.deepEqual([piece.x, piece.z], [-0.3, 0.1]);
  assert.equal(log.filter((e) => e === "pick").length, 1);
  dragger.pointer("move", ray(-0.2, 0.1), 1);
  assert.ok(Math.abs(piece.x - -0.2) < 1e-9);
});

test("cancel upuszcza element i następny palec znów chwyta", () => {
  const { log, dragger } = setup();
  dragger.pointer("down", ray(-0.3, 0.1), 1);
  dragger.cancel();
  assert.ok(log.includes("drop"));
  dragger.pointer("down", ray(-0.3, 0.1), 3);
  assert.equal(log.filter((e) => e === "pick").length, 2);
});

test("promień bez przecięcia i wyłączone przeciąganie nie ruszają elementu", () => {
  const { piece, log, dragger } = setup();
  dragger.pointer("down", ray(-0.3, 0.1), 1);
  dragger.pointer("move", { origin: { x: 0, y: 1, z: 0 }, direction: { x: 0, y: 0.5, z: 1 } }, 1);
  assert.deepEqual([piece.x, piece.z], [-0.3, 0.1]);
  dragger.cancel();
  dragger.enabled = false;
  log.length = 0;
  dragger.pointer("down", ray(-0.3, 0.1), 1);
  assert.deepEqual(log, []);
});

test("element nie wychodzi poza obszar", () => {
  const { piece, dragger } = setup();
  dragger.pointer("down", ray(-0.3, 0.1), 1);
  dragger.pointer("move", ray(50, 0.1), 1);
  assert.ok(piece.x <= 1 + DRAG_MARGIN);
});

test("miejsce świeci tylko blisko celu i tylko na poziomach z podpowiedziami", () => {
  const t = targetOf(0, 0, level);
  const easy = setup();
  easy.dragger.pointer("down", ray(-0.3, 0.1), 1);
  easy.dragger.pointer("move", ray(t.x, t.z), 1);
  assert.ok(easy.log.includes("near"));
  const hard = setup({ level: LEVELS.trudny });
  const target = targetOf(0, 0, LEVELS.trudny);
  hard.dragger.pointer("down", ray(-0.3, 0.1), 1);
  hard.dragger.pointer("move", ray(target.x, target.z), 1);
  assert.ok(!hard.log.includes("near"));
});

test("ułożony element nie daje się chwycić", () => {
  const { piece, log, dragger } = setup();
  piece.placed = true;
  dragger.pointer("down", ray(-0.3, 0.1), 1);
  assert.deepEqual(log, []);
});
