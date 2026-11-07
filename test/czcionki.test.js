import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("strona nie łączy się z Google Fonts", () => {
  assert.doesNotMatch(read("../app/index.html"), /fonts\.(googleapis|gstatic)\.com/);
});

test("każda czcionka z arkusza leży przy aplikacji", () => {
  const files = [...read("../app/css/podstawa.css").matchAll(/url\("\.\.\/(media\/czcionki\/[^"]+)"\)/g)].map((match) => match[1]);
  assert.equal(files.length, 4);
  for (const file of files) assert.ok(existsSync(new URL(`../app/${file}`, import.meta.url)), file);
});

test("czcionki mają dołączone licencje", () => {
  for (const name of ["Fraunces", "Inter"]) {
    assert.match(read(`../app/media/czcionki/${name}.OFL.txt`), /SIL OPEN FONT LICENSE/i);
  }
});
