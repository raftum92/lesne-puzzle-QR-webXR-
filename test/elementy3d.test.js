import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../app/vendor/three.module.min.js";
import { LEVELS } from "../app/js/poziomy.js";
import { createCuts } from "../app/js/ksztalty.js";
import { THICKNESS, cellSize } from "../app/js/ar/uklad.js";
import { createPieceMesh } from "../app/js/ar/elementy3d.js";

const level = LEVELS.latwy;
const cuts = createCuts(3, 2, () => 0.5);
const { cw, ch } = cellSize(level);

test("współrzędne obrazka odpowiadają miejscu na planszy", () => {
  const { mesh } = createPieceMesh(cuts, 1, 2, level, new THREE.Texture()).userData;
  const { position, uv } = mesh.geometry.attributes;
  const cx = 2.5 * cw;
  const cz = 1.5 * ch;
  for (let i = 0; i < position.count; i++) {
    assert.ok(Math.abs(uv.getX(i) - (position.getX(i) + cx)) < 1e-5);
    assert.ok(Math.abs(uv.getY(i) - (1 - (position.getZ(i) + cz) / (9 / 16))) < 1e-5);
  }
});

test("element leży na y = 0 i ma grubość THICKNESS", () => {
  const { mesh } = createPieceMesh(cuts, 0, 0, level, new THREE.Texture()).userData;
  mesh.geometry.computeBoundingBox();
  const { min, max } = mesh.geometry.boundingBox;
  assert.ok(Math.abs(min.y) < 1e-6);
  assert.ok(Math.abs(max.y - THICKNESS) < 1e-6);
});

test("środek komórki leży w początku układu elementu", () => {
  const { mesh } = createPieceMesh(cuts, 0, 1, level, new THREE.Texture()).userData;
  mesh.geometry.computeBoundingBox();
  const { min, max } = mesh.geometry.boundingBox;
  // Prosta krawędź górna leży dokładnie pół komórki od środka, bo element (0, 1) nie ma nad sobą sąsiada.
  assert.ok(Math.abs(min.z + ch / 2) < 1e-6);
  assert.ok(min.x < -cw / 2 + 0.15 && max.x > cw / 2 - 0.15);
});

test("bez tekstury cienia element nie ma cienia", () => {
  assert.equal(createPieceMesh(cuts, 0, 0, level, new THREE.Texture()).userData.shadow, null);
  const withShadow = createPieceMesh(cuts, 0, 0, level, new THREE.Texture(), new THREE.Texture());
  assert.ok(withShadow.userData.shadow);
});
