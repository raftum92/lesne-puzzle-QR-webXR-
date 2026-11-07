import { test } from "node:test";
import assert from "node:assert/strict";
import { Animator } from "../app/js/ar/animacje.js";

test("add kończy się true, a clear daje false", async () => {
  const a = new Animator();
  const seen = [];
  const done = a.add(100, (e) => seen.push(e));
  a.update(0);
  a.update(50);
  a.update(100);
  assert.deepEqual(seen, [0, 0.5, 1]);
  assert.equal(await done, true);
  const cleared = a.add(100, () => {});
  a.clear();
  assert.equal(await cleared, false);
});

test("krzywa przelicza postęp", async () => {
  const a = new Animator();
  const seen = [];
  const done = a.add(100, (e) => seen.push(e), (k) => k * k);
  a.update(0);
  a.update(50);
  a.update(100);
  assert.deepEqual(seen, [0, 0.25, 1]);
  assert.equal(await done, true);
});

test("skończona animacja nie dostaje kolejnych klatek", async () => {
  const a = new Animator();
  let calls = 0;
  const done = a.add(10, () => calls++);
  a.update(0);
  a.update(10);
  a.update(20);
  assert.equal(calls, 2);
  assert.equal(await done, true);
});

test("reducedMotion skraca animację do 300 ms", async () => {
  const a = new Animator({ reducedMotion: true });
  const done = a.add(1300, () => {});
  a.update(0);
  a.update(300);
  assert.equal(await done, true);
});
