import { test } from "node:test";
import assert from "node:assert/strict";
import { detectAr } from "../app/js/ar/wykrywanie.js";

const xr = (result) => ({
  isSessionSupported: async () => {
    if (result instanceof Error) throw result;
    return result;
  },
});

test("wykrywa AR i brak AR", async () => {
  const location = { hostname: "example.com", search: "" };
  assert.equal(await detectAr({ location, navigator: { xr: xr(true) } }), "xr");
  assert.equal(await detectAr({ location, navigator: { xr: xr(false) } }), null);
  assert.equal(await detectAr({ location, navigator: {} }), null);
  assert.equal(await detectAr({ location, navigator: { xr: xr(new Error("SecurityError")) } }), null);
});

test("symulator działa tylko lokalnie", async () => {
  const search = "?ar=symulacja";
  assert.equal(await detectAr({ location: { hostname: "localhost", search }, navigator: {} }), "symulacja");
  assert.equal(await detectAr({ location: { hostname: "127.0.0.1", search }, navigator: {} }), "symulacja");
  assert.equal(await detectAr({ location: { hostname: "example.com", search }, navigator: {} }), null);
});

test("sprawdza dokładnie immersive-ar", async () => {
  const asked = [];
  const navigator = { xr: { isSessionSupported: async (mode) => (asked.push(mode), true) } };
  await detectAr({ location: { hostname: "localhost", search: "" }, navigator });
  assert.deepEqual(asked, ["immersive-ar"]);
});

test("telefon bez AR, ale z kamerą, dostaje tryb z kamerą", async () => {
  const location = { hostname: "example.com", search: "" };
  const mediaDevices = { getUserMedia: async () => ({}) };
  assert.equal(await detectAr({ location, navigator: { xr: xr(false), mediaDevices }, touch: true }), "kamera");
  assert.equal(await detectAr({ location, navigator: { mediaDevices }, touch: true }), "kamera");
  assert.equal(await detectAr({ location, navigator: { xr: xr(true), mediaDevices }, touch: true }), "xr");
});

test("komputer z kamerką i telefon bez kamery grają na ekranie", async () => {
  const location = { hostname: "example.com", search: "" };
  const mediaDevices = { getUserMedia: async () => ({}) };
  assert.equal(await detectAr({ location, navigator: { xr: xr(false), mediaDevices }, touch: false }), null);
  assert.equal(await detectAr({ location, navigator: { xr: xr(false) }, touch: true }), null);
});

test("tryb z kamerą da się wymusić tylko lokalnie", async () => {
  const search = "?ar=kamera";
  assert.equal(await detectAr({ location: { hostname: "localhost", search }, navigator: {} }), "kamera");
  assert.equal(await detectAr({ location: { hostname: "example.com", search }, navigator: {} }), null);
});
