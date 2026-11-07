import { test } from "node:test";
import assert from "node:assert/strict";
import { Progress, resolveMode } from "../app/js/postep.js";

test("nieznany albo brakujący tryb to ekran", () => {
  const p = new Progress();
  assert.equal(p.mode, "ekran");
  p.data.mode = "zepsuty";
  assert.equal(p.mode, "ekran");
});

test("reset zachowuje tryb", () => {
  const p = new Progress();
  p.mode = "pokoj";
  p.reset();
  assert.equal(p.mode, "pokoj");
});

test("zepsuty zapis postępu nie blokuje startu gry", () => {
  for (const saved of ['{"done":null}', '{"done":"x"}', "null", "5", "nie-json"]) {
    globalThis.localStorage = { getItem: () => saved, setItem() {} };
    const p = new Progress();
    assert.equal(p.best("lis", "latwy"), null, saved);
    assert.equal(p.count(["lis"], ["latwy"]), 0, saved);
  }
  delete globalThis.localStorage;
});

test("postęp nie ma już ustawienia straszenia", () => {
  const p = new Progress();
  assert.equal("scare" in p, false);
  assert.equal("scare" in p.data, false);
});

test("tryb pokoj bez AR daje ekran", () => {
  assert.equal(resolveMode("pokoj", null), "ekran");
  assert.equal(resolveMode("pokoj", "xr"), "pokoj");
  assert.equal(resolveMode("pokoj", "symulacja"), "pokoj");
  assert.equal(resolveMode("ekran", "xr"), "ekran");
});
