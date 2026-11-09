// Tryb z kamerą na atrapach: zgoda na kamerę, wyłączanie kamery i dotyk kilkoma palcami.
import { test } from "node:test";
import assert from "node:assert/strict";

globalThis.location = new URL("https://example.com/app/");
globalThis.window = { devicePixelRatio: 1 };
const pageListeners = new Map();
globalThis.addEventListener = (type, handler) => pageListeners.set(type, handler);
globalThis.removeEventListener = (type, handler) => pageListeners.get(type) === handler && pageListeners.delete(type);

class FakeNode extends EventTarget {
  parent = null;
  remove() {
    this.parent?.children.splice(this.parent.children.indexOf(this), 1);
    this.parent = null;
  }
}

class FakeVideo extends FakeNode {
  played = false;
  play() {
    this.played = true;
    return Promise.resolve();
  }
}

globalThis.document = Object.assign(new EventTarget(), {
  visibilityState: "visible",
  createElement: () => new FakeVideo(),
});

const { CameraSession } = await import("../app/js/ar/sesja.js");

function fakeRoot(width = 360, height = 800) {
  return {
    children: [],
    clientWidth: width,
    clientHeight: height,
    prepend(node) {
      node.remove?.();
      node.parent = this;
      this.children.unshift(node);
    },
  };
}

function fakeRenderer() {
  const canvas = new FakeNode();
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 360, height: 800 });
  return {
    domElement: canvas,
    xr: { enabled: true },
    loop: null,
    setSize() {},
    setAnimationLoop(callback) {
      this.loop = callback;
    },
    render() {},
  };
}

function fakeCamera() {
  const track = { stopped: false, stop() {
    this.stopped = true;
  } };
  const stream = { getTracks: () => [track] };
  return { track, stream, api: { getUserMedia: async () => stream } };
}

function useCamera(mediaDevices) {
  Object.defineProperty(globalThis, "navigator", { value: { mediaDevices }, configurable: true });
}

test("odmowa dostępu do kamery to brak zgody, a brak kamery to niedostępność", async () => {
  for (const [name, code] of [["NotAllowedError", "denied"], ["SecurityError", "denied"], ["NotFoundError", "unavailable"], ["NotReadableError", "unavailable"]]) {
    useCamera({ getUserMedia: async () => Promise.reject(Object.assign(new Error(name), { name })) });
    const session = new CameraSession(fakeRoot(), fakeRenderer());
    await assert.rejects(session.start(), (error) => error.code === code);
    assert.equal(session.ended, true);
  }
});

test("obraz z kamery leży pod płótnem, a plansza ma od razu swoje miejsce", async () => {
  const { api } = fakeCamera();
  useCamera(api);
  const root = fakeRoot();
  const renderer = fakeRenderer();
  const session = new CameraSession(root, renderer);
  await session.start();
  assert.equal(root.children[0].className, "ar__feed");
  assert.equal(root.children[1], renderer.domElement);
  assert.equal(renderer.xr.enabled, false);
  assert.ok(session.fixedView && session.surface);
  assert.equal(session.frontHomes, true, "pionowy ekran: elementy pod planszą");
  session.placeBoard(1.2);
  assert.equal(session.placement.scale.x, 1, "rozmiar planszy nie zależy od wybranej małej albo dużej");
  session.stop();
});

test("wyjście z gry gasi kamerę i zdejmuje obraz", async () => {
  const { api, track } = fakeCamera();
  useCamera(api);
  const root = fakeRoot();
  const session = new CameraSession(root, fakeRenderer());
  let ended = false;
  session.onEnd(() => (ended = true));
  await session.start();
  session.stop();
  assert.equal(track.stopped, true);
  assert.equal(root.children.length, 0);
  assert.equal(ended, true);
  assert.equal(pageListeners.size, 0);
});

test("wyjście w czasie pytania o zgodę też gasi kamerę", async () => {
  const { stream, track } = fakeCamera();
  let grant;
  useCamera({ getUserMedia: () => new Promise((resolve) => (grant = resolve)) });
  const root = fakeRoot();
  const session = new CameraSession(root, fakeRenderer());
  const starting = session.start();
  session.stop();
  grant(stream);
  await assert.rejects(starting);
  assert.equal(track.stopped, true);
  assert.equal(root.children.length, 0);
});

test("drugi palec nie kończy przeciągania pierwszego", async () => {
  const { api } = fakeCamera();
  useCamera(api);
  const renderer = fakeRenderer();
  const session = new CameraSession(fakeRoot(), renderer);
  await session.start();
  const events = [];
  session.onPointer((type) => events.push(type));
  const touch = (type, pointerId, target = globalThis) => {
    const event = Object.assign(new Event(type), { pointerId, clientX: 180, clientY: 600 });
    if (target === globalThis) pageListeners.get(type)?.(event);
    else target.dispatchEvent(event);
  };
  touch("pointerdown", 1, renderer.domElement);
  touch("pointerdown", 2, renderer.domElement);
  touch("pointermove", 2);
  touch("pointerup", 2);
  touch("pointermove", 1);
  touch("pointercancel", 1);
  assert.deepEqual(events, ["down", "move", "up"]);
  session.stop();
});

test("widok przechodzi z planszy przed ramę", async () => {
  const { api } = fakeCamera();
  useCamera(api);
  const session = new CameraSession(fakeRoot(), fakeRenderer());
  await session.start();
  const lying = session.camera.position.clone();
  session.setStanding(1);
  const standing = session.camera.position.clone();
  assert.ok(lying.y > standing.y, "z góry na planszę");
  assert.ok(standing.z > lying.z, "naprzeciw ramy");
  session.stop();
});
