// Gra AR i sesja WebXR na atrapach: sytuacje, których symulator nie umie odtworzyć.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Group } from "../app/vendor/three.module.min.js";
import { targetOf } from "../app/js/ar/uklad.js";

globalThis.location = new URL("http://localhost/app/");
globalThis.matchMedia = () => ({ matches: false });
globalThis.window = { devicePixelRatio: 1 };
const createdVideos = [];
globalThis.document = {
  createElement: (tag) => {
    if (tag === "video") {
      const video = new FakeVideo();
      createdVideos.push(video);
      return video;
    }
    return { getContext: () => ({ createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, drawImage() {} }) };
  },
};
globalThis.Image = class {
  naturalWidth = 16;
  naturalHeight = 9;
  decode() {
    return Promise.resolve();
  }
};
const xrApi = {};
Object.defineProperty(globalThis, "navigator", { value: { xr: xrApi }, configurable: true });

class FakeVideo extends EventTarget {
  paused = true;
  muted = false;
  duration = 8;
  error = null;
  currentTime = 0;
  play() {
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
  removeAttribute(name) {
    delete this[name];
  }
}

const { ArGame } = await import("../app/js/ar/gra-ar.js");
const { XrSession } = await import("../app/js/ar/sesja.js");
const { Frame } = await import("../app/js/ar/rama.js");
const { LEVELS } = await import("../app/js/poziomy.js");

class FakeElement extends EventTarget {
  constructor() {
    super();
    this.found = new Map();
    this.dataset = {};
    this.children = [];
    this.hidden = false;
    const classes = new Set();
    this.classList = {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
      contains: (name) => classes.has(name),
      toggle() {},
    };
  }
  querySelector(selector) {
    if (!this.found.has(selector)) this.found.set(selector, new FakeElement());
    return this.found.get(selector);
  }
  querySelectorAll() {
    return [];
  }
  setAttribute() {}
  focus() {}
}


function fakeRenderer() {
  return {
    renders: 0,
    loop: null,
    xr: {
      enabled: false,
      setFramebufferScaleFactor() {},
      setReferenceSpaceType() {},
      setSession: async () => {},
      getReferenceSpace: () => ({}),
    },
    setAnimationLoop(callback) {
      this.loop = callback;
    },
    render() {
      this.renders++;
    },
  };
}

function fakeXr({ failHitTest = false } = {}) {
  const xr = new EventTarget();
  xr.endCalls = 0;
  xr.visibilityState = "visible";
  xr.end = async () => {
    xr.endCalls++;
    xr.dispatchEvent(new Event("end"));
  };
  xr.requestReferenceSpace = async () => ({});
  xr.requestHitTestSource = async () => {
    if (failHitTest) throw new Error("brak hit-test");
    return {};
  };
  return xr;
}

const tick = () => new Promise((resolve) => setImmediate(resolve));
const silent = () => new Proxy({}, { get: () => () => {} });

function makeGame(options = {}) {
  const log = [];
  const renderer = fakeRenderer();
  const game = new ArGame({
    root: new FakeElement(),
    sounds: silent(),
    progress: { record: () => ({ first: true, record: false, best: 1 }) },
    video: new FakeVideo(),
    kind: "xr",
    onExit: () => log.push("exit"),
    onStartError: () => log.push("start-error"),
    onNavigate: (id) => log.push(`nav:${id}`),
    sessionFactory: (kind, root) => new XrSession(root, renderer),
    ...options,
  });
  return { game, log, renderer };
}

// Gra w trakcie: bez sesji AR, z planszą w pamięci.
function gameInProgress(options, animal = "lis") {
  const made = makeGame(options);
  const { game } = made;
  game.level = LEVELS.latwy;
  game.session = { stop() {}, scene: new Group() };
  game.setAnimal(animal);
  game.board = new Group();
  game.image = new Image();
  game.frameObject = new Frame({ parent: game.board, animator: game.animator, image: game.image });
  return made;
}

function finish(game) {
  game.token++;
  game.animator.clear();
}

test("szybkie dotknięcie ostatniego elementu nie psuje następnej klatki", () => {
  const { game } = gameInProgress();
  game.buildPuzzle();
  game.phase = "puzzle";
  game.animator.update(0);
  for (const piece of game.pieces.slice(0, 5)) piece.placed = true;
  const last = game.pieces[5];
  Object.assign(last, targetOf(last.r, last.c, game.level));
  game.dragger.toBoard = (ray) => ray;
  const ray = { origin: { x: last.x, y: 1, z: last.z }, direction: { x: 0, y: -1, z: 0 } };
  game.dragger.pointer("down", ray, 1);
  game.dragger.pointer("up", ray, 1);
  assert.equal(game.phase, "reveal");
  assert.doesNotThrow(() => game.animator.update(50));
  finish(game);
});

test("koniec układania czyści podpowiedź", () => {
  const { game } = gameInProgress();
  game.buildPuzzle();
  game.phase = "puzzle";
  game.setHint("Porusz telefonem, żeby znów zobaczyć podłogę");
  for (const piece of game.pieces) {
    piece.placed = true;
    game.onSnap(piece);
  }
  assert.equal(game.phase, "reveal");
  assert.equal(game.el.hint.textContent, "");
  finish(game);
});

test("błąd w jednej klatce nie zatrzymuje pętli AR", async () => {
  const renderer = fakeRenderer();
  const xr = fakeXr();
  xrApi.requestSession = async () => xr;
  const session = new XrSession(new FakeElement(), renderer);
  await session.start();
  session.onFrame(() => {
    throw new Error("błąd w klatce");
  });
  const frame = { getViewerPose: () => null, getHitTestResults: () => [] };
  const error = console.error;
  console.error = () => {};
  try {
    assert.doesNotThrow(() => renderer.loop(0, frame));
  } finally {
    console.error = error;
  }
  assert.equal(renderer.renders, 1);
});

test("wyjście w czasie startu AR kończy sesję, gdy przeglądarka ją odda", async () => {
  let grant;
  xrApi.requestSession = () => new Promise((resolve) => (grant = resolve));
  const { game, log, renderer } = makeGame();
  const started = game.start("lis", "latwy");
  await tick();
  await game.requestExit();
  const xr = fakeXr();
  grant(xr);
  await started;
  await tick();
  assert.equal(xr.endCalls, 1);
  assert.equal(renderer.loop, null);
  assert.deepEqual(log, ["exit"]);
});

test("błąd po przyznaniu sesji kończy ją i wraca do menu", async () => {
  const xr = fakeXr({ failHitTest: true });
  xrApi.requestSession = async () => xr;
  const { game, log, renderer } = makeGame();
  const warn = console.warn;
  console.warn = () => {};
  await game.start("lis", "latwy");
  console.warn = warn;
  assert.equal(xr.endCalls, 1);
  assert.equal(renderer.loop, null);
  assert.deepEqual(log, ["exit", "start-error"]);
});

// Chrome na telefonie bez ARCore zgłasza AR, a odmawia dopiero przy starcie sesji.
function cameraFallbackGame(error, cameraError = null) {
  xrApi.requestSession = async () => Promise.reject(error);
  const kinds = [];
  const changes = [];
  const failures = [];
  const camera = {
    fixedView: true,
    surface: {},
    scene: new Group(),
    start: async () => {
      if (cameraError) throw cameraError;
    },
    stop() {},
    placeBoard: () => new Group(),
    onFrame: () => () => {},
    onPointer: () => () => {},
    onEnd: () => () => {},
    onVisibility: () => () => {},
  };
  const renderer = fakeRenderer();
  const made = makeGame({
    cameraFallback: true,
    onKindChange: (kind) => changes.push(kind),
    onStartError: (codes) => failures.push(...codes),
    sessionFactory: (kind, root) => (kinds.push(kind), kind === "kamera" ? camera : new XrSession(root, renderer)),
  });
  return { ...made, kinds, changes, failures };
}

async function quietly(action) {
  const warn = console.warn;
  console.warn = () => {};
  try {
    await action();
  } finally {
    console.warn = warn;
  }
}

test("telefon bez ARCore, na którym sesja AR nie ruszyła, gra dalej z kamerą", async () => {
  const { game, log, kinds, changes } = cameraFallbackGame(Object.assign(new Error("ARCore"), { name: "NotSupportedError" }));
  const warn = console.warn;
  console.warn = () => {};
  await game.start("lis", "latwy");
  console.warn = warn;
  assert.deepEqual(kinds, ["xr", "kamera"]);
  assert.deepEqual(changes, ["kamera"]);
  assert.deepEqual(log, [], "bez wychodzenia do menu i bez okna z błędem");
  assert.equal(game.kind, "kamera");
  assert.equal(game.root.dataset.kind, "kamera");
  assert.equal(game.phase, "intro");
  finish(game);
});

test("odmowa w trybie W przestrzeni też kończy się próbą z kamerą", async () => {
  // Chrome bez ARCore zgłasza tak np. odrzuconą prośbę o instalację ARCore, nie tylko odmowę zgody.
  const { game, log, kinds } = cameraFallbackGame(Object.assign(new Error("odmowa"), { name: "NotAllowedError" }));
  await quietly(() => game.start("lis", "latwy"));
  assert.deepEqual(kinds, ["xr", "kamera"]);
  assert.deepEqual(log, []);
  assert.equal(game.phase, "intro");
  finish(game);
});

test("po drugim braku gestu gra przechodzi na kamerę zamiast znów prosić o dotknięcie", async () => {
  const { game, kinds } = cameraFallbackGame(Object.assign(new Error("activation"), { name: "SecurityError" }));
  await quietly(() => game.start("lis", "latwy"));
  assert.equal(game.phase, "start", "pierwszy raz: przycisk Uruchom");
  assert.equal(game.el.start.hidden, false);
  await quietly(() => game.retry());
  assert.deepEqual(kinds, ["xr", "xr", "kamera"]);
  assert.equal(game.phase, "intro");
  finish(game);
});

test("gdy nie ruszy też kamera, okno z błędem dostaje kody obu błędów", async () => {
  const { game, log, failures } = cameraFallbackGame(
    Object.assign(new Error("ARCore"), { name: "NotSupportedError" }),
    Object.assign(new Error("zajęta"), { code: "unavailable", reason: "NotReadableError" }),
  );
  await quietly(() => game.start("lis", "latwy"));
  assert.deepEqual(log, ["exit"]);
  assert.deepEqual(failures, ["xr NotSupportedError", "kamera NotReadableError"]);
});

test("błąd przy tworzeniu sesji wraca do menu", async () => {
  const { game, log } = makeGame({
    sessionFactory: () => {
      throw new Error("brak WebGL");
    },
  });
  const warn = console.warn;
  console.warn = () => {};
  await game.start("lis", "latwy");
  console.warn = warn;
  assert.deepEqual(log, ["exit", "start-error"]);
});

test("podwójne dotknięcie Następne zwierzę przechodzi tylko o jedno zwierzę", async () => {
  const { game, log } = gameInProgress();
  game.phase = "info";
  game.next();
  await tick();
  game.next();
  await tick();
  assert.equal(game.animal.id, "jelen");
  assert.deepEqual(log, ["nav:jelen"]);
  finish(game);
});

test("Obejrzyj jeszcze raz w czasie kładzenia obrazu nic nie robi", async () => {
  const { game } = gameInProgress();
  game.phase = "info";
  game.next();
  await tick();
  game.replay();
  await tick();
  await tick();
  assert.equal(game.video.paused, true);
  finish(game);
});

test("film, który nigdy nie ruszy, nie blokuje gry", async () => {
  const { game } = gameInProgress();
  game.video.play = () => new Promise(() => {});
  const result = game.playFilm(game.token);
  await tick();
  game.animator.update(0);
  game.animator.update(8000);
  const outcome = await Promise.race([result, new Promise((resolve) => setTimeout(() => resolve("wisi"), 100))]);
  assert.equal(outcome, false);
  assert.equal(game.video.paused, true);
  finish(game);
});

const until = async (condition) => {
  for (let i = 0; i < 40 && !condition(); i++) await new Promise((resolve) => setTimeout(resolve, 5));
  assert.ok(condition(), "warunek się nie spełnił");
};

// Ryś po ostatniej klatce zwykłego filmu: film się kończy i gra przechodzi dalej.
async function afterFilm(options) {
  const made = gameInProgress(options, "rys");
  const { game } = made;
  const watching = game.watchFilm(game.token);
  game.video.dispatchEvent(new Event("ended"));
  await tick();
  return { ...made, watching };
}

test("po zwykłym filmie ryś wyskakuje z ramy, a potem są informacje", async () => {
  const { game, watching } = await afterFilm();
  await until(() => game.frameObject.jumpVisible);
  assert.equal(game.jumpVideo.paused, false);
  assert.equal(game.jumpVideo.src, game.animal.jump.video);
  assert.equal(game.phase, "video");
  game.jumpVideo.dispatchEvent(new Event("ended"));
  await watching;
  assert.equal(game.phase, "info");
  finish(game);
});

test("stary zapis z wyłączonym straszeniem niczego nie zmienia", async () => {
  const { game, watching } = await afterFilm({
    progress: { record: () => ({}), scare: false },
  });
  await until(() => game.frameObject.jumpVisible);
  assert.equal(game.jumpVideo.paused, false);
  game.jumpVideo.dispatchEvent(new Event("ended"));
  await watching;
  finish(game);
});

test("systemowe ograniczenie ruchu kończy na zwykłym filmie", async () => {
  const { game } = gameInProgress(undefined, "rys");
  game.animator.reducedMotion = true;
  const watching = game.watchFilm(game.token);
  game.video.dispatchEvent(new Event("ended"));
  await watching;
  assert.equal(game.phase, "info");
  assert.equal(game.jumpVideo.paused, true);
  finish(game);
});

test("zwierzę bez skoku kończy na zwykłym filmie", async () => {
  const { game } = gameInProgress();
  game.animal = { ...game.animal, jump: undefined };
  const watching = game.watchFilm(game.token);
  game.video.dispatchEvent(new Event("ended"));
  await watching;
  assert.equal(game.phase, "info");
  assert.equal(game.jumpVideo.paused, true);
  finish(game);
});

test("pominięcie zwykłego filmu pomija też skok", async () => {
  const { game } = gameInProgress(undefined, "rys");
  const watching = game.watchFilm(game.token);
  game.el.skip.dispatchEvent(new Event("click"));
  await watching;
  assert.equal(game.phase, "info");
  assert.equal(game.jumpVideo.paused, true);
  finish(game);
});

test("pominięcie w czasie skoku zatrzymuje go i pokazuje informacje", async () => {
  const { game, watching } = await afterFilm();
  await until(() => game.frameObject.jumpVisible);
  game.el.skip.dispatchEvent(new Event("click"));
  await watching;
  assert.equal(game.phase, "info");
  assert.equal(game.jumpVideo.paused, true);
  finish(game);
});

test("wyjście w czasie skoku wycisza go", async () => {
  const { game, log, watching } = await afterFilm();
  await until(() => game.frameObject.jumpVisible);
  await game.requestExit();
  await watching;
  assert.equal(game.jumpVideo.paused, true);
  assert.deepEqual(log.filter((entry) => entry === "exit"), ["exit"]);
  assert.equal(game.phase, "idle");
});

test("gdy przeglądarka zablokuje dźwięk skoku, gra go bez dźwięku", async () => {
  const { game } = gameInProgress(undefined, "rys");
  let calls = 0;
  game.jumpVideo.play = function () {
    calls++;
    if (calls === 1) return Promise.reject(Object.assign(new Error("zablokowane"), { name: "NotAllowedError" }));
    this.paused = false;
    return Promise.resolve();
  };
  const watching = game.watchFilm(game.token);
  game.video.dispatchEvent(new Event("ended"));
  await until(() => game.frameObject.jumpVisible);
  assert.equal(game.jumpVideo.muted, true);
  game.jumpVideo.dispatchEvent(new Event("ended"));
  await watching;
  assert.equal(game.phase, "info");
  finish(game);
});

test("skok, który nie rusza, nie blokuje gry", async () => {
  const made = gameInProgress(undefined, "rys");
  const { game } = made;
  game.jumpVideo.play = () => new Promise(() => {});
  const watching = game.watchFilm(game.token);
  game.video.dispatchEvent(new Event("ended"));
  await tick();
  game.animator.update(0);
  game.animator.update(8000);
  await Promise.race([watching, new Promise((resolve) => setTimeout(resolve, 200))]);
  assert.equal(game.phase, "info");
  assert.equal(game.jumpVideo.paused, true);
  finish(game);
});

test("następne zwierzę chowa skok i ładuje swój film ze skokiem", async () => {
  const { game, watching } = await afterFilm();
  await until(() => game.frameObject.jumpVisible);
  game.jumpVideo.dispatchEvent(new Event("ended"));
  await watching;
  game.next();
  await tick();
  await tick();
  assert.equal(game.animal.id, "sowa");
  assert.equal(game.frameObject.jumpVisible, false);
  assert.equal(game.jumpVideo.src, "../assets/filmy-skok/sowa.mp4");
  finish(game);
});

test("przy ograniczeniu ruchu gra nie ładuje filmu ze skokiem", () => {
  const { game } = gameInProgress(undefined, "rys");
  game.animator.reducedMotion = true;
  game.setAnimal("sowa");
  assert.equal(game.jumpVideo.src, undefined);
  finish(game);
});

test("skok rusza przed końcem zwykłego filmu i płynnie się pojawia", async () => {
  const { game } = gameInProgress(undefined, "rys");
  const watching = game.watchFilm(game.token);
  game.video.currentTime = 7;
  game.frame(1000, true);
  assert.equal(game.jumpVideo.paused, true, "za wcześnie");
  game.video.currentTime = 7.7;
  game.frame(1033, true);
  assert.equal(game.jumpVideo.paused, false);
  await until(() => game.frameObject.jumpVisible);
  const { opacity } = game.frameObject.jump.material.uniforms;
  game.animator.update(2000);
  assert.equal(opacity.value, 0, "przenikanie zaczyna się od zwykłego filmu");
  game.animator.update(2300);
  assert.equal(opacity.value, 1);
  // Koniec zwykłego filmu niczego już nie przerywa.
  game.video.dispatchEvent(new Event("ended"));
  await tick();
  assert.equal(game.phase, "video");
  assert.equal(game.jumpVideo.paused, false);
  game.jumpVideo.dispatchEvent(new Event("ended"));
  await watching;
  assert.equal(game.phase, "info");
  finish(game);
});

test("skok uruchamia się tylko raz", async () => {
  const { game } = gameInProgress(undefined, "rys");
  let plays = 0;
  const play = game.jumpVideo.play.bind(game.jumpVideo);
  game.jumpVideo.play = () => {
    plays++;
    return play();
  };
  const watching = game.watchFilm(game.token);
  game.video.currentTime = 7.7;
  game.frame(1000, true);
  game.frame(1033, true);
  game.video.dispatchEvent(new Event("ended"));
  await until(() => game.frameObject.jumpVisible);
  assert.equal(plays, 1);
  game.jumpVideo.dispatchEvent(new Event("ended"));
  await watching;
  finish(game);
});

test("pominięcie tuż przed końcem filmu zatrzymuje rozpoczęty skok", async () => {
  const { game } = gameInProgress(undefined, "rys");
  const watching = game.watchFilm(game.token);
  game.video.currentTime = 7.7;
  game.frame(1000, true);
  game.el.skip.dispatchEvent(new Event("click"));
  await watching;
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(game.phase, "info");
  assert.equal(game.jumpVideo.paused, true);
  assert.equal(game.frameObject.jumpVisible, false, "skok nie może pojawić się po pominięciu");
  finish(game);
});

test("telefon z kodu QR nie proponuje następnego zwierzęcia", () => {
  const result = { seconds: 30, level: LEVELS.latwy, first: true, record: false, best: 30 };
  const one = gameInProgress({ oneAnimal: true }).game;
  one.renderInfoPanel(result);
  assert.doesNotMatch(one.el.info.innerHTML, /Następne zwierzę/);
  assert.match(one.el.info.innerHTML, /Ułóż jeszcze raz/);
  const all = gameInProgress().game;
  all.renderInfoPanel(result);
  assert.match(all.el.info.innerHTML, /Następne zwierzę/);
  finish(one);
  finish(all);
});

test("w trybie z kamerą plansza staje od razu, bez szukania podłogi", async () => {
  const placed = [];
  const session = {
    fixedView: true,
    surface: {},
    scene: new Group(),
    start: async () => {},
    stop() {},
    placeBoard: (meters) => (placed.push(meters), new Group()),
    onFrame: () => () => {},
    onPointer: () => () => {},
    onEnd: () => () => {},
    onVisibility: () => () => {},
  };
  const { game } = makeGame({ kind: "kamera", sessionFactory: () => session });
  await game.start("lis", "latwy");
  assert.equal(placed.length, 1);
  assert.equal(game.phase, "intro");
  assert.equal(game.root.dataset.kind, "kamera");
  finish(game);
});

test("w trybie z kamerą widok idzie za wstającą i kładącą się ramą", () => {
  const { game } = gameInProgress();
  const steps = [];
  game.session.fixedView = true;
  game.session.setStanding = (k) => steps.push(k);
  game.moveView(100, 0, 1);
  game.animator.update(0);
  game.animator.update(200);
  game.moveView(100, 1, 0);
  game.animator.update(250);
  game.animator.update(400);
  assert.equal(steps.at(0), 0);
  assert.ok(steps.includes(1));
  assert.equal(steps.at(-1), 0);
  finish(game);
});

test("powtórka filmu pokazuje skok jeszcze raz", async () => {
  const { game, watching } = await afterFilm();
  await until(() => game.frameObject.jumpVisible);
  game.jumpVideo.dispatchEvent(new Event("ended"));
  await watching;
  game.replay();
  await until(() => game.phase === "video");
  assert.equal(game.frameObject.jumpVisible, false);
  game.video.dispatchEvent(new Event("ended"));
  await until(() => game.frameObject.jumpVisible);
  game.jumpVideo.dispatchEvent(new Event("ended"));
  await until(() => game.phase === "info");
  finish(game);
});

