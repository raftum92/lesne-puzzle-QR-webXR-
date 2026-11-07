// Gra na ekranie na atrapach: element wideo jest wspólny z trybem „W pokoju”.
import { test } from "node:test";
import assert from "node:assert/strict";

globalThis.matchMedia = () => ({ matches: false });
globalThis.addEventListener = () => {};
globalThis.document = { addEventListener() {} };

const { Game } = await import("../app/js/gra.js");

const CLEANUP_MS = 750; // gra sprząta po 700 ms, kiedy ekran gry już zniknie

function makeGame(src) {
  const element = () => ({
    addEventListener() {},
    classList: { add() {}, remove() {} },
    querySelectorAll: () => [],
    style: {},
  });
  const attributes = new Map([["src", src]]);
  const video = {
    ...element(),
    loads: 0,
    pause() {},
    load() {
      this.loads++;
    },
    getAttribute: (name) => attributes.get(name) ?? null,
    removeAttribute: (name) => attributes.delete(name),
    setAttribute: (name, value) => attributes.set(name, value),
  };
  const elements = new Map([["#video", video]]);
  const root = {
    dataset: {},
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, element());
      return elements.get(selector);
    },
    querySelectorAll: () => [],
  };
  const game = new Game({ root, sounds: {}, progress: {}, backdrop: {}, confirm() {}, onExit() {}, onNavigate() {} });
  game.animal = { video: src };
  return { game, video };
}

test("wyjście z gry zwalnia jej film", async () => {
  const { game, video } = makeGame("../assets/filmy/lis.mp4");
  game.stop();
  await new Promise((resolve) => setTimeout(resolve, CLEANUP_MS));
  assert.equal(video.getAttribute("src"), null);
  assert.equal(video.loads, 1);
});

test("wyjście z gry nie zabiera filmu trybowi W pokoju", async () => {
  const { game, video } = makeGame("../assets/filmy/lis.mp4");
  game.stop();
  video.setAttribute("src", "../assets/filmy-720p/sowa.mp4");
  await new Promise((resolve) => setTimeout(resolve, CLEANUP_MS));
  assert.equal(video.getAttribute("src"), "../assets/filmy-720p/sowa.mp4");
  assert.equal(video.loads, 0);
});
