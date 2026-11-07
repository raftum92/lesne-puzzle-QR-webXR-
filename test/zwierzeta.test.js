import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { ANIMALS, ORDER } from "../app/js/zwierzeta.js";

test("każde zwierzę ma lżejszy film do AR", () => {
  for (const id of ORDER) {
    assert.equal(ANIMALS[id].arVideo, `../assets/filmy-720p/${id}.mp4`);
    assert.ok(existsSync(new URL(`../assets/filmy-720p/${id}.mp4`, import.meta.url)));
  }
});
