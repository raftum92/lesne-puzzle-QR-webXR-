import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { qrMatrix, qrSvg } from "../app/js/qr.js";

const rows = (matrix) => matrix.map((row) => row.map(Number).join(""));
const hash = (matrix) => createHash("sha256").update(rows(matrix).join("\n")).digest("hex").slice(0, 16);
const BASE = "https://raftum92.github.io/lesne-puzzle-QR-webXR-/app/";

// Skróty macierzy z niezależnej biblioteki qrcode (Python), korekcja M, tryb bajtowy, podana maska.
const REFERENCE = [
  { text: "a", version: 1, mask: 0, hash: "ad65f877bf9411d1" },
  { text: "a".repeat(15), version: 2, mask: 3, hash: "c29ab8e36af944d7" },
  { text: `${BASE}?zwierze=lis&poziom=latwy`, version: 5, mask: 5, hash: "a28184f3df6fc0f5" },
  { text: `${BASE}?zwierze=wiewiorka&poziom=latwy`, version: 6, mask: 2, hash: "71016eff6769af2f" },
  { text: "a".repeat(107), version: 7, mask: 4, hash: "ef8f0cf8bacf42a0" },
  { text: "a".repeat(153), version: 9, mask: 7, hash: "61678c48934dcf32" },
];

test("macierz zgadza się z inną implementacją bit po bicie", () => {
  for (const { text, version, mask, hash: expected } of REFERENCE) {
    const matrix = qrMatrix(text, mask);
    assert.equal(matrix.length, version * 4 + 17, text);
    assert.equal(hash(matrix), expected, `${text}, maska ${mask}`);
  }
});

test("bez podanej maski wybiera jedną z ośmiu poprawnych", () => {
  const text = `${BASE}?zwierze=lis&poziom=latwy`;
  const best = rows(qrMatrix(text)).join("\n");
  const all = [0, 1, 2, 3, 4, 5, 6, 7].map((mask) => rows(qrMatrix(text, mask)).join("\n"));
  assert.ok(all.includes(best));
});

test("za długi tekst to wyraźny błąd, a nie zepsuty kod", () => {
  assert.equal(qrMatrix("a".repeat(180)).length, 53);
  assert.throws(() => qrMatrix("a".repeat(181)), RangeError);
});

test("SVG ma biały margines i całą liczbę pikseli na moduł", () => {
  const svg = qrSvg(`${BASE}?zwierze=lis&poziom=latwy`);
  const side = 37 + 8;
  assert.match(svg, new RegExp(`viewBox="0 0 ${side} ${side}"`));
  assert.match(svg, new RegExp(`width="${side * 5}"`));
  assert.match(svg, /<rect [^>]*fill="#fff"/);
  assert.match(svg, /d="M4 4h1v1h-1z/); // róg wzorca pozycji leży tuż za marginesem
});
