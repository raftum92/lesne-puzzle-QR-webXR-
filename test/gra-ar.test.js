// Gra AR i sesja WebXR na atrapach: sytuacje, których symulator nie umie odtworzyć.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Box3, Group, Vector3 } from "../app/vendor/three.module.min.js";
import { BOARD_H, FRAME_SCALE, UPRIGHT_TOP, targetOf } from "../app/js/ar/uklad.js";

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
const { CameraSession, XrSession } = await import("../app/js/ar/sesja.js");
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

// Jak w Chrome 143: renderState leży w prototypie i ma pole layers także bez funkcji "layers".
class FakeXrSession extends EventTarget {
  get renderState() {
    return { layers: [], depthNear: 0.1 };
  }
}

function fakeXr({ failHitTest = false, features = ["local", "viewer", "hit-test", "dom-overlay", "anchors"] } = {}) {
  const xr = new FakeXrSession();
  xr.enabledFeatures = features;
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

// Plansza postawiona przez sesję W przestrzeni na powierzchni metr przed graczem, który stoi od strony +z.
function standingBoard(meters = 1.2) {
  const session = new XrSession(new FakeElement(), fakeRenderer());
  session.surface = { position: new Vector3(0, 0, -1), yaw: 0 };
  const board = session.placeBoard(meters);
  session.scene.updateMatrixWorld(true);
  return { session, board };
}
const toWorld = (object, x, y, z) => object.localToWorld(new Vector3(x, y, z));
const direction = (object, x, y, z) => toWorld(object, x, y, z).sub(toWorld(object, 0, 0, 0)).normalize();
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

test("w trybie W przestrzeni plansza stoi pionowo przodem do gracza", () => {
  const { board } = standingBoard(1.2);
  const top = toWorld(board, 0.5, 0, 0);
  const bottom = toWorld(board, 0.5, 0, BOARD_H);
  assert.ok(near(top.x, 0) && near(top.y, UPRIGHT_TOP * 1.2) && near(top.z, -1), "górny brzeg nad punktem powierzchni");
  assert.ok(near(bottom.y, (UPRIGHT_TOP - BOARD_H) * 1.2) && near(bottom.z, -1), "dolny brzeg pod nim");
  assert.ok(near(direction(board, 0, 1, 0).z, 1), "przód planszy patrzy na gracza");
});

test("na pionowej planszy palec trafia tam, gdzie celuje", () => {
  const { game } = makeGame();
  game.board = standingBoard(1.2).board;
  const origin = new Vector3(0.2, 1.4, 0.5);
  const aim = toWorld(game.board, 0.3, 0, 0.2).sub(origin).normalize();
  const { origin: o, direction: d } = game.toBoard({ origin, direction: aim });
  const { x, z } = (() => { const t = -o.y / d.y; return { x: o.x + d.x * t, z: o.z + d.z * t }; })();
  assert.ok(o.y > 0 && d.y < 0, "gracz stoi przed planszą");
  assert.ok(near(x, 0.3) && near(z, 0.2));
});

test("w trybie z kamerą plansza dalej leży płasko w środku sceny", () => {
  const session = new CameraSession(new FakeElement(), fakeRenderer());
  session.surface = { position: new Vector3(0.5, 0, BOARD_H / 2), yaw: 0 };
  const board = session.placeBoard();
  session.scene.updateMatrixWorld(true);
  assert.ok(near(direction(board, 0, 1, 0).y, 1));
  assert.ok(toWorld(board, 0, 0, 0).length() < 1e-9, "stały widok zakłada początek planszy w środku sceny");
});

test("na pionowej planszy obraz wysuwa się do gracza i rośnie, zamiast wstawać", () => {
  const { game } = makeGame();
  const { board } = standingBoard(1.2);
  const frame = new Frame({ parent: board, animator: game.animator, image: new Image(), upright: true });
  const picture = frame.group.children.at(-1);
  const centerOnBoard = () => board.worldToLocal(picture.getWorldPosition(new Vector3()));
  frame.applyPose(0);
  const lying = centerOnBoard();
  frame.applyPose(1);
  const standing = centerOnBoard();
  assert.ok(near(lying.x, 0.5) && near(lying.z, BOARD_H / 2), "leżąc, obraz pokrywa planszę");
  assert.ok(near(standing.x, 0.5) && near(standing.z, BOARD_H / 2), "wysunięty obraz zostaje na wprost planszy");
  assert.ok(standing.y > lying.y + 0.1, "obraz wysuwa się w stronę gracza");
  assert.equal(frame.group.scale.x, FRAME_SCALE);
  assert.ok(near(direction(picture, 0, 0, 1).z, 1, 1e-6), "obraz patrzy na gracza");
});

test("obrys przy stawianiu stoi tam, gdzie stanie plansza", async () => {
  const { game } = makeGame();
  xrApi.requestSession = async () => fakeXr();
  await game.start("lis", "latwy");
  game.session.surface = { position: new Vector3(0, 0, -1), yaw: 0 };
  game.updateOutline(0);
  const box = new Box3().setFromObject(game.outline);
  assert.ok(near(box.max.y, UPRIGHT_TOP * 1.2, 0.02), `góra obrysu ${box.max.y}`);
  assert.ok(near(box.min.y, (UPRIGHT_TOP - BOARD_H) * 1.2, 0.02), `dół obrysu ${box.min.y}`);
  assert.ok(near(box.min.z, -1, 0.02) && near(box.max.z, -1, 0.02), "obrys jest pionowy");
  finish(game);
});

// ARCore na słabszych telefonach gubi znalezioną podłogę na sekundę i znów ją znajduje (OnePlus Nord 4, 9.11.2026).
test("chwilowo zgubiona podłoga zostaje przez sekundę, żeby dało się postawić planszę", async () => {
  const renderer = fakeRenderer();
  xrApi.requestSession = async () => fakeXr();
  const session = new XrSession(new FakeElement(), renderer);
  await session.start();
  const floor = { getPose: () => ({ transform: { position: { x: 0, y: 0, z: -1 }, orientation: { x: 0, y: 0, z: 0, w: 1 } } }) };
  const frame = (hits) => ({
    getViewerPose: () => ({ emulatedPosition: false, transform: { position: { x: 0, y: 1.4, z: 0 } } }),
    getHitTestResults: () => hits,
  });
  renderer.loop(0, frame([floor]));
  assert.ok(session.surface, "podłoga znaleziona");
  renderer.loop(900, frame([]));
  assert.deepEqual(session.surface?.position.toArray(), [0, 0, -1], "po 0,9 s bez trafienia gra pamięta podłogę");
  renderer.loop(1100, frame([]));
  assert.equal(session.surface, null, "po ponad sekundzie bez trafienia podłoga znika");
});

// Z boku widać tylko krawędź stojącej planszy (OnePlus Nord 4, 9.11.2026: 75° obok gracza po przejściu w bok).
test("stojąca plansza płynnie obraca się przodem do gracza, gdy ten przejdzie w bok", async () => {
  const renderer = fakeRenderer();
  xrApi.requestSession = async () => fakeXr();
  const session = new XrSession(new FakeElement(), renderer);
  await session.start();
  const floor = { getPose: () => ({ transform: { position: { x: 0, y: 0, z: -2 }, orientation: { x: 0, y: 0, z: 0, w: 1 } } }) };
  const frameAt = (eye, hits = []) => ({
    getViewerPose: () => ({ emulatedPosition: false, transform: { position: eye } }),
    getHitTestResults: () => hits,
  });
  renderer.loop(0, frameAt({ x: 0, y: 1.4, z: 0 }, [floor]));
  session.placeBoard(1.2);
  assert.ok(near(session.placement.rotation.y, 0), "po postawieniu plansza patrzy na gracza");
  const side = { x: 2, y: 1.4, z: -2 }; // gracz stoi teraz z prawej strony planszy
  renderer.loop(50, frameAt(side));
  const early = session.placement.rotation.y;
  assert.ok(early > 0 && early < Math.PI / 4, `obrót jest płynny, nie skokowy (${early})`);
  for (let t = 100; t <= 3000; t += 50) renderer.loop(t, frameAt(side));
  assert.ok(near(session.placement.rotation.y, Math.PI / 2, 0.01), "po chwili plansza patrzy na gracza");
});

test("obrót do gracza idzie krótszą drogą przez tył planszy", async () => {
  const renderer = fakeRenderer();
  xrApi.requestSession = async () => fakeXr();
  const session = new XrSession(new FakeElement(), renderer);
  await session.start();
  session.surface = { position: new Vector3(0, 0, 0), yaw: Math.PI - 0.1 };
  session.placeBoard(1.2);
  const frameAt = (eye) => ({ getViewerPose: () => ({ emulatedPosition: false, transform: { position: eye } }), getHitTestResults: () => [] });
  const behind = { x: Math.sin(-Math.PI + 0.1), y: 1.4, z: Math.cos(-Math.PI + 0.1) }; // 0,2 rad dalej, za ±180°
  renderer.loop(0, frameAt(behind));
  for (let t = 50; t <= 3000; t += 50) renderer.loop(t, frameAt(behind));
  const yaw = session.placement.rotation.y;
  assert.ok(near(Math.cos(yaw), Math.cos(-Math.PI + 0.1), 1e-3) && near(Math.sin(yaw), Math.sin(-Math.PI + 0.1), 1e-3));
});

// Chrome 143 nie pokazuje obrazu z XRProjectionLayer w sesji bez funkcji "layers" (OnePlus Nord 4, 9.11.2026).
test("bez funkcji layers Three.js rysuje przez XRWebGLLayer", async () => {
  const renderer = fakeRenderer();
  let layersSeen = "nie sprawdzono";
  renderer.xr.setSession = async (session) => {
    layersSeen = session.renderState.layers;
  };
  const xr = fakeXr();
  xrApi.requestSession = async () => xr;
  await new XrSession(new FakeElement(), renderer).start();
  assert.equal(layersSeen, undefined);
  assert.deepEqual(xr.renderState.layers, [], "po starcie sesja pokazuje prawdziwy stan");
});

test("z funkcją layers Three.js może użyć XRProjectionLayer", async () => {
  const renderer = fakeRenderer();
  let layersSeen = "nie sprawdzono";
  renderer.xr.setSession = async (session) => {
    layersSeen = session.renderState.layers;
  };
  xrApi.requestSession = async () => fakeXr({ features: ["local", "viewer", "hit-test", "dom-overlay", "layers"] });
  await new XrSession(new FakeElement(), renderer).start();
  assert.deepEqual(layersSeen, []);
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

