// Sesja AR: obraz, szukanie podłogi, plansza trzymana w miejscu i dotyk.
// XrSession działa na telefonie, a SimulatedSession na komputerze. Reszta kodu nie wie, której używa.
import * as THREE from "../../vendor/three.module.min.js";
import { BOARD_H } from "./uklad.js";

const MAX_TILT_COS = Math.cos((20 * Math.PI) / 180); // bardziej odchylona powierzchnia to już nie podłoga ani stół
const SIM_SURFACE_MS = 500; // po takim czasie symulator „znajduje” podłogę
const XR_RESOLUTION = 0.7; // pełna rozdzielczość telefonu daje tylko 20–25 kl./s przy pustej scenie, a ta stałe 30

// Jeden renderer na całą stronę: przeglądarki pozwalają tylko na kilka kontekstów WebGL.
let sharedRenderer = null;

function getRenderer() {
  sharedRenderer ??= new THREE.WebGLRenderer({ antialias: true, alpha: true });
  sharedRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  return sharedRenderer;
}

function disposeTree(root) {
  root.traverse((object) => {
    object.geometry?.dispose();
    for (const material of [object.material].flat()) {
      material?.map?.dispose();
      material?.dispose();
    }
  });
}

class Session {
  constructor(overlayRoot, renderer = getRenderer()) {
    this.overlayRoot = overlayRoot;
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.01, 40);
    this.surface = null;
    this.tracking = true;
    this.visibilityState = "visible";
    this.ended = false;
    this.listeners = { frame: new Set(), pointer: new Set(), end: new Set(), visibility: new Set() };
    // Grupa zewnętrzna stoi na środku planszy; wewnętrzna ma początek w lewym dalszym rogu, jak uklad.js.
    this.placement = new THREE.Group();
    this.board = new THREE.Group();
    this.board.position.set(-0.5, 0, -BOARD_H / 2);
    this.placement.add(this.board);
    this.placement.visible = false;
    this.scene.add(this.placement);
  }

  listen(kind, callback) {
    this.listeners[kind].add(callback);
    return () => this.listeners[kind].delete(callback);
  }

  emit(kind, ...args) {
    for (const callback of this.listeners[kind]) callback(...args);
  }

  // Wyjątek przeszedłby przez pętlę Three.js, która już nie poprosiłaby o kolejną klatkę, i obraz by zamarzł.
  emitFrame(time) {
    try {
      this.emit("frame", time, this.tracking);
    } catch (error) {
      console.error("Błąd w klatce AR:", error);
    }
  }

  // callback(time, tracking)
  onFrame(callback) {
    return this.listen("frame", callback);
  }

  // callback(type, ray, id), gdzie type to "down", "move" albo "up"
  onPointer(callback) {
    return this.listen("pointer", callback);
  }

  onEnd(callback) {
    return this.listen("end", callback);
  }

  onVisibility(callback) {
    return this.listen("visibility", callback);
  }

  // Stawia planszę na ostatnio znalezionej powierzchni. Kolejne wywołanie przenosi tę samą grupę.
  placeBoard(widthMeters) {
    this.placement.position.copy(this.surface.position);
    this.placement.rotation.y = this.surface.yaw;
    this.placement.scale.setScalar(widthMeters);
    this.placement.visible = true;
    return this.board;
  }

  finish() {
    if (this.ended) return;
    this.ended = true;
    this.renderer.setAnimationLoop(null);
    disposeTree(this.scene);
    this.emit("end");
  }
}

export class XrSession extends Session {
  async start() {
    let session;
    try {
      session = await navigator.xr.requestSession("immersive-ar", {
        requiredFeatures: ["hit-test", "dom-overlay"],
        optionalFeatures: ["anchors"],
        domOverlay: { root: this.overlayRoot },
      });
    } catch (error) {
      this.finish();
      throw Object.assign(new Error(error.message), { code: errorCode(error) });
    }
    this.xr = session;
    this.touches = new Map();
    this.nextTouch = 1;
    session.addEventListener("end", () => this.finish());
    session.addEventListener("visibilitychange", () => {
      this.visibilityState = session.visibilityState;
      this.emit("visibility", session.visibilityState);
    });
    session.addEventListener("selectstart", (event) => this.touchStart(event));
    session.addEventListener("selectend", (event) => this.touchEnd(event));
    const renderer = this.renderer;
    try {
      if (this.stopRequested) throw new Error("Gracz wyszedł, zanim przeglądarka oddała sesję");
      renderer.xr.enabled = true;
      renderer.xr.setFramebufferScaleFactor(XR_RESOLUTION);
      renderer.xr.setReferenceSpaceType("local");
      await renderer.xr.setSession(session);
      this.space = renderer.xr.getReferenceSpace();
      const viewer = await session.requestReferenceSpace("viewer");
      this.hitSource = await session.requestHitTestSource({ space: viewer });
      if (this.stopRequested) throw new Error("Gracz wyszedł w czasie uruchamiania sesji");
    } catch (error) {
      // Przyznana sesja musi się zakończyć, inaczej zostaje obraz z kamery bez żadnych przycisków.
      await session.end().catch(() => this.finish());
      throw Object.assign(new Error(error.message), { code: "unavailable" });
    }
    renderer.setAnimationLoop((time, frame) => this.frame(time, frame));
  }

  frame(time, frame) {
    if (!frame) return;
    const pose = frame.getViewerPose(this.space);
    this.tracking = Boolean(pose) && !pose.emulatedPosition;
    if (pose) this.findSurface(frame, pose);
    if (this.anchor && frame.trackedAnchors?.has(this.anchor)) {
      const anchorPose = frame.getPose(this.anchor.anchorSpace, this.space);
      if (anchorPose) this.placement.position.copy(anchorPose.transform.position);
    }
    for (const [source, id] of this.touches) {
      const ray = this.rayOf(source, frame);
      if (ray) this.emit("pointer", "move", ray, id);
    }
    this.emitFrame(time);
    this.renderer.render(this.scene, this.camera);
  }

  // Pierwsze trafienie w poziomą powierzchnię, z planszą ustawioną bliższym brzegiem do gracza.
  findSurface(frame, viewerPose) {
    const up = new THREE.Vector3();
    for (const hit of frame.getHitTestResults(this.hitSource)) {
      const pose = hit.getPose(this.space);
      if (!pose) continue;
      const { position, orientation } = pose.transform;
      up.set(0, 1, 0).applyQuaternion(new THREE.Quaternion(orientation.x, orientation.y, orientation.z, orientation.w));
      if (up.y < MAX_TILT_COS) continue;
      const eye = viewerPose.transform.position;
      this.lastHit = hit;
      this.surface = {
        position: new THREE.Vector3(position.x, position.y, position.z),
        yaw: Math.atan2(eye.x - position.x, eye.z - position.z),
      };
      return;
    }
    this.lastHit = null;
    this.surface = null;
  }

  placeBoard(widthMeters) {
    const board = super.placeBoard(widthMeters);
    this.anchor?.delete();
    this.anchor = null;
    this.lastHit
      ?.createAnchor?.()
      ?.then((anchor) => {
        this.anchor = anchor;
      })
      .catch(() => {}); // bez kotwicy plansza zostaje w zapisanej pozycji
    return board;
  }

  rayOf(source, frame) {
    const pose = frame.getPose(source.targetRaySpace, this.space);
    if (!pose) return null;
    const { position, orientation } = pose.transform;
    const quaternion = new THREE.Quaternion(orientation.x, orientation.y, orientation.z, orientation.w);
    return {
      origin: new THREE.Vector3(position.x, position.y, position.z),
      direction: new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion),
    };
  }

  touchStart(event) {
    const ray = this.rayOf(event.inputSource, event.frame);
    if (!ray) return;
    const id = this.nextTouch++;
    this.touches.set(event.inputSource, id);
    this.emit("pointer", "down", ray, id);
  }

  touchEnd(event) {
    const id = this.touches.get(event.inputSource);
    if (id === undefined) return;
    this.touches.delete(event.inputSource);
    const ray = this.rayOf(event.inputSource, event.frame);
    this.emit("pointer", "up", ray, id);
  }

  // Sesji jeszcze nie ma, gdy przeglądarka wciąż ją uruchamia: wtedy kończy ją start().
  stop() {
    if (this.ended) return;
    this.stopRequested = true;
    this.xr?.end().catch(() => this.finish());
  }
}

// Próba bez telefonu: szara podłoga, mysz zamiast palca, strzałki krążą kamerą.
class SimulatedSession extends Session {
  // Próba błędów startu: ?ar=symulacja&blad=denied albo unavailable, albo gesture.
  static nextError = new URLSearchParams(location.search).get("blad");

  async start() {
    if (SimulatedSession.nextError) {
      const code = SimulatedSession.nextError;
      SimulatedSession.nextError = null;
      throw Object.assign(new Error(`Symulowany błąd: ${code}`), { code });
    }
    const renderer = this.renderer;
    renderer.xr.enabled = false;
    this.canvas = renderer.domElement;
    this.canvas.className = "ar__canvas";
    this.overlayRoot.prepend(this.canvas);
    this.scene.background = new THREE.Color(0x3c403c);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x7f837d }));
    floor.position.y = -0.002;
    this.scene.add(floor, new THREE.GridHelper(12, 24, 0x565a55, 0x6a6e68));
    this.orbit = { angle: 0, elevation: 0.6, radius: 2.6 };
    this.startTime = performance.now();
    this.touching = false;
    this.handlers = {
      resize: () => this.resize(),
      keydown: (event) => this.onKey(event),
      pointermove: (event) => this.touching && this.emit("pointer", "move", this.rayAt(event), 0),
      pointerup: (event) => {
        if (!this.touching) return;
        this.touching = false;
        this.emit("pointer", "up", this.rayAt(event), 0);
      },
    };
    this.onPointerDown = (event) => {
      this.touching = true;
      this.emit("pointer", "down", this.rayAt(event), 0);
    };
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    for (const [type, handler] of Object.entries(this.handlers)) addEventListener(type, handler);
    this.resize();
    this.moveCamera();
    renderer.setAnimationLoop((time) => this.frame(time));
  }

  frame(time) {
    if (!this.surface && performance.now() - this.startTime >= SIM_SURFACE_MS) {
      this.surface = { position: new THREE.Vector3(0, 0, 0), yaw: 0 };
    }
    this.emitFrame(time);
    this.renderer.render(this.scene, this.camera);
  }

  resize() {
    const { clientWidth: width, clientHeight: height } = this.overlayRoot;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
  }

  onKey(event) {
    const step = { ArrowLeft: [-0.1, 0], ArrowRight: [0.1, 0], ArrowUp: [0, 0.06], ArrowDown: [0, -0.06] }[event.key];
    if (!step) return;
    event.preventDefault();
    this.orbit.angle += step[0];
    this.orbit.elevation = Math.min(1.5, Math.max(0.15, this.orbit.elevation + step[1]));
    this.moveCamera();
  }

  moveCamera() {
    const { angle, elevation, radius } = this.orbit;
    this.camera.position.set(
      radius * Math.cos(elevation) * Math.sin(angle),
      radius * Math.sin(elevation),
      radius * Math.cos(elevation) * Math.cos(angle),
    );
    this.camera.lookAt(0, 0, 0);
    this.camera.updateMatrixWorld();
  }

  rayAt(event) {
    const rect = this.canvas.getBoundingClientRect();
    const pointer = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointer, this.camera);
    return { origin: raycaster.ray.origin.clone(), direction: raycaster.ray.direction.clone() };
  }

  stop() {
    if (this.ended) return;
    if (this.canvas) {
      this.canvas.removeEventListener("pointerdown", this.onPointerDown);
      this.canvas.remove();
      for (const [type, handler] of Object.entries(this.handlers)) removeEventListener(type, handler);
    }
    this.finish();
  }
}

// Przeglądarka zgłasza brak gestu jako SecurityError, a odmowę zgody jako NotAllowedError.
function errorCode(error) {
  if (error.name === "SecurityError" || /activation|gesture/i.test(error.message)) return "gesture";
  if (error.name === "NotAllowedError") return "denied";
  return "unavailable";
}

export function createSession(kind, overlayRoot) {
  return kind === "symulacja" ? new SimulatedSession(overlayRoot) : new XrSession(overlayRoot);
}
