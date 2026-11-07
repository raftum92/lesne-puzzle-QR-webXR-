import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { ANIMALS, ORDER } from "../app/js/zwierzeta.js";
import { JUMP_FADE_MS, JUMP_OVERLAP_S, JUMP_PICTURE, canJump, jumpDue, jumpPlane } from "../app/js/ar/skok.js";

test("skok działa zawsze dla zwierzęcia z takim filmem", () => {
  assert.equal(canJump(ANIMALS.rys, { reducedMotion: false }), true);
  assert.equal(canJump({}, { reducedMotion: false }), false);
});

test("systemowe ograniczenie ruchu daje zwykły film", () => {
  assert.equal(canJump(ANIMALS.rys, { reducedMotion: true }), false);
});

test("w grze nie ma przełącznika „Bez straszenia”", () => {
  const html = readFileSync(new URL("../app/index.html", import.meta.url), "utf8");
  assert.ok(!html.includes("scareToggle"));
  assert.ok(!html.includes("Bez straszenia"));
});

test("każde zwierzę wyskakuje z ramy i wibruje w trakcie filmu", () => {
  for (const id of ORDER) {
    assert.equal(canJump(ANIMALS[id], { reducedMotion: false }), true, id);
    assert.equal(ANIMALS[id].jump.video, `../assets/filmy-skok/${id}.mp4`);
    assert.ok(ANIMALS[id].jump.vibrateAt > 0 && ANIMALS[id].jump.vibrateAt < 4.6, id);
  }
});

test("pliki filmów ze skokiem istnieją", () => {
  for (const id of ORDER) {
    const { video } = ANIMALS[id].jump;
    assert.ok(existsSync(new URL(`../app/${video}`, import.meta.url)), video);
  }
});

test("płaszczyzna filmu kładzie obraz z filmu dokładnie na obrazie w ramie", () => {
  const { width, height } = jumpPlane(1);
  assert.ok(Math.abs(width * JUMP_PICTURE.w - 1) < 1e-9, "szerokość obrazu w filmie to szerokość obrazu w ramie");
  assert.ok(Math.abs(height / width - 16 / 9) < 1e-9, "proporcje pionowego filmu");
  // Obraz leży na środku kadru, więc środek płaszczyzny to środek obrazu w ramie.
  assert.ok(Math.abs(JUMP_PICTURE.x + JUMP_PICTURE.w / 2 - 0.5) < 1e-9);
  assert.ok(Math.abs(JUMP_PICTURE.y + JUMP_PICTURE.h / 2 - 0.5) < 0.001);
});

test("skok rusza tuż przed końcem filmu, a przenikanie mieści się w tej zakładce", () => {
  assert.equal(jumpDue(8 - JUMP_OVERLAP_S - 0.01, 8), false);
  assert.equal(jumpDue(8 - JUMP_OVERLAP_S, 8), true);
  assert.equal(jumpDue(8, 8), true);
  assert.equal(jumpDue(0, Number.NaN), false, "film jeszcze bez długości");
  assert.ok(JUMP_FADE_MS / 1000 <= JUMP_OVERLAP_S);
});
