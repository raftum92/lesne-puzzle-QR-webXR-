// Sesja AR: obraz, kierunek telefonu, plansza trzymana w miejscu i dotyk.
// XrSession działa na telefonie z ARCore, CameraSession na pozostałych telefonach, a SimulatedSession na komputerze.
// Reszta kodu nie wie, której używa.
import * as THREE from "../../vendor/three.module.min.js";
import { BOARD_H, UPRIGHT_PIVOT, boardPose, facingTilt, fixedView } from "./uklad.js";

const SIM_TARGET_Y = 1; // wysokość, na którą patrzy kamera symulatora
const FACE_MS = 400; // stała czasu obrotu stojącej planszy do gracza: po 0,4 s zostaje 37% kąta
const FACE_MIN_METERS = 0.2;
const DEFAULT_TAN_HALF_FOV = Math.tan((33 * Math.PI) / 360); // telefon w pionie, gdy przeglądarka nie poda rzutowania
const XR_RESOLUTION = 0.7; // pełna rozdzielczość telefonu daje tylko 20–25 kl./s przy pustej scenie, a ta stałe 30
const CAMERA_REQUEST = { audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } };

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
    this.surface = null; // stałe miejsce planszy w trybie z kamerą
    this.view = null; // skąd i dokąd patrzy telefon: { eye, forward, quaternion, tanHalfFov, tanHalfFovY }
    this.tracking = true;
    this.visibilityState = "visible";
    this.ended = false;
    this.listeners = { frame: new Set(), pointer: new Set(), end: new Set(), visibility: new Set() };
    // Grupa zewnętrzna stoi w punkcie powierzchni i patrzy na gracza, środkowa stawia planszę do pionu,
    // a wewnętrzna ma początek w lewym dalszym rogu, jak uklad.js.
    this.placement = new THREE.Group();
    this.stand = new THREE.Group();
    this.board = new THREE.Group();
    this.tilt = 0;
    poseBoard(this.stand, this.board, 0, BOARD_H / 2);
    this.stand.add(this.board);
    this.placement.add(this.stand);
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

  // Stawia planszę w `spot` ({ position, yaw, tilt }), domyślnie w stałym miejscu trybu z kamerą. Kolejne wywołanie
  // przenosi tę samą grupę. Sesja z `upright` zawiesza ją zwróconą do gracza (bez `tilt` pionowo) i obraca wokół
  // środka całości z elementami, a bez niego kładzie płasko; podklasa ustawia to pole, więc czyta się je tutaj.
  placeBoard(widthMeters, spot = this.surface) {
    this.tilt = this.upright ? (spot.tilt ?? Math.PI / 2) : 0;
    poseBoard(this.stand, this.board, this.tilt, this.upright ? UPRIGHT_PIVOT : BOARD_H / 2);
    this.placement.position.copy(spot.position);
    this.placement.rotation.y = spot.yaw;
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
  upright = true; // pionowa plansza: leżącą widać z telefonu pod zbyt ostrym kątem

  async start() {
    let session;
    try {
      session = await navigator.xr.requestSession("immersive-ar", {
        requiredFeatures: ["dom-overlay"],
        optionalFeatures: ["anchors"],
        domOverlay: { root: this.overlayRoot },
      });
    } catch (error) {
      this.finish();
      throw Object.assign(new Error(error.message), { code: errorCode(error), reason: error.name });
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
      await setSessionWithoutLayers(renderer, session);
      this.space = renderer.xr.getReferenceSpace();
      if (this.stopRequested) throw new Error("Gracz wyszedł w czasie uruchamiania sesji");
    } catch (error) {
      // Przyznana sesja musi się zakończyć, inaczej zostaje obraz z kamery bez żadnych przycisków.
      await session.end().catch(() => this.finish());
      throw Object.assign(new Error(error.message), { code: "unavailable", reason: error.name });
    }
    renderer.setAnimationLoop((time, frame) => this.frame(time, frame));
  }

  frame(time, frame) {
    if (!frame) return;
    const pose = frame.getViewerPose(this.space);
    this.tracking = Boolean(pose) && !pose.emulatedPosition;
    if (pose) this.view = viewOf(pose);
    if (this.anchorWanted) this.createAnchor(frame);
    if (this.anchor && frame.trackedAnchors?.has(this.anchor)) {
      const anchorPose = frame.getPose(this.anchor.anchorSpace, this.space);
      if (anchorPose) this.placement.position.copy(anchorPose.transform.position);
    }
    if (pose) this.faceViewer(pose.transform.position, time);
    for (const [source, id] of this.touches) {
      const ray = this.rayOf(source, frame);
      if (ray) this.emit("pointer", "move", ray, id);
    }
    this.emitFrame(time);
    this.renderer.render(this.scene, this.camera);
  }

  // Z boku albo z góry wisząca plansza jest widoczna pod ostrym kątem. Gracz chodzi, kuca i wstaje, a ARCore
  // przesuwa kotwicę, więc plansza płynnie obraca się przodem do telefonu: w bok krótszą drogą i do tyłu jak pulpit.
  faceViewer(eye, time) {
    const elapsed = time - (this.facedAt ?? time);
    this.facedAt = time;
    if (!this.upright || !this.placement.visible) return;
    const { position, rotation } = this.placement;
    const dx = eye.x - position.x;
    const dz = eye.z - position.z;
    if (Math.hypot(dx, dz) < FACE_MIN_METERS) return; // telefon tuż nad planszą: kierunek byłby przypadkowy
    const k = 1 - Math.exp(-elapsed / FACE_MS);
    const turn = Math.atan2(dx, dz) - rotation.y;
    rotation.y += Math.atan2(Math.sin(turn), Math.cos(turn)) * k;
    this.tilt += (facingTilt(eye, position) - this.tilt) * k;
    poseBoard(this.stand, this.board, this.tilt, UPRIGHT_PIVOT);
  }

  // Kotwica powstaje w następnej klatce, bo tylko w niej da się ją utworzyć.
  placeBoard(widthMeters, spot) {
    const board = super.placeBoard(widthMeters, spot);
    this.anchor?.delete();
    this.anchor = null;
    this.anchorWanted = true;
    return board;
  }

  // Kotwica w wolnej przestrzeni: ARCore poprawia nią położenie planszy, kiedy lepiej rozpozna pokój.
  createAnchor(frame) {
    this.anchorWanted = false;
    if (!frame.createAnchor || typeof XRRigidTransform !== "function") return;
    const ticket = (this.anchorTicket = (this.anchorTicket ?? 0) + 1);
    const { x, y, z } = this.placement.position;
    frame
      .createAnchor(new XRRigidTransform({ x, y, z }), this.space)
      .then((anchor) => {
        if (ticket === this.anchorTicket && !this.ended) this.anchor = anchor;
        else anchor.delete?.(); // plansza zdążyła się przenieść
      })
      .catch(() => {}); // bez kotwicy plansza zostaje w zapisanej pozycji
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

// Sesja na zwykłym płótnie, bez WebXR: palec albo mysz jako promień i kamera sceny ustawiana z kodu.
class CanvasSession extends Session {
  attachCanvas(extraHandlers = {}) {
    this.renderer.xr.enabled = false;
    this.canvas = this.renderer.domElement;
    this.canvas.className = "ar__canvas";
    this.overlayRoot.prepend(this.canvas);
    this.touch = null; // palec, który dotknął pierwszy; kolejne nie mogą zakończyć jego przeciągania
    const release = (event) => {
      if (event.pointerId !== this.touch) return;
      this.touch = null;
      this.emit("pointer", "up", this.rayAt(event), 0);
    };
    this.handlers = {
      resize: () => this.resize(),
      pointermove: (event) => event.pointerId === this.touch && this.emit("pointer", "move", this.rayAt(event), 0),
      pointerup: release,
      pointercancel: release,
      ...extraHandlers,
    };
    this.onPointerDown = (event) => {
      if (this.touch !== null) return;
      this.touch = event.pointerId;
      this.emit("pointer", "down", this.rayAt(event), 0);
    };
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    for (const [type, handler] of Object.entries(this.handlers)) addEventListener(type, handler);
    this.resize();
  }

  frame(time) {
    this.emitFrame(time);
    this.renderer.render(this.scene, this.camera);
  }

  resize() {
    const { clientWidth: width, clientHeight: height } = this.overlayRoot;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
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

// Telefon bez ARCore: obraz z kamery pod przezroczystą sceną. Podłogi nie da się tu znaleźć, więc plansza
// stoi w stałym miejscu ekranu, a kamera sceny sama przechodzi przed ramę, kiedy obraz wstaje.
export class CameraSession extends CanvasSession {
  fixedView = true;

  async start() {
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(CAMERA_REQUEST);
    } catch (error) {
      this.finish();
      // Blokada zasad strony to też brak zgody; kolejne dotknięcie niczego by nie zmieniło.
      const code = error.name === "NotAllowedError" || error.name === "SecurityError" ? "denied" : "unavailable";
      throw Object.assign(new Error(error.message), { code, reason: error.name });
    }
    this.stream = stream;
    if (this.ended) {
      this.stopCamera();
      throw Object.assign(new Error("Gracz wyszedł, zanim przeglądarka oddała kamerę"), { code: "unavailable" });
    }
    this.feed = document.createElement("video");
    this.feed.className = "ar__feed";
    this.feed.muted = true;
    this.feed.playsInline = true;
    this.feed.srcObject = stream;
    this.overlayRoot.prepend(this.feed);
    try {
      await this.feed.play();
    } catch (error) {
      this.stop();
      throw Object.assign(new Error(error.message), { code: "unavailable", reason: error.name });
    }
    if (this.ended) throw Object.assign(new Error("Gracz wyszedł w czasie uruchamiania kamery"), { code: "unavailable" });
    this.surface = { position: new THREE.Vector3(0.5, 0, BOARD_H / 2), yaw: 0 }; // początek planszy w środku sceny
    this.standing = 0;
    this.frontHomes = this.overlayRoot.clientWidth < this.overlayRoot.clientHeight;
    this.attachCanvas();
    this.overlayRoot.prepend(this.feed); // pod płótnem
    this.onDocumentVisibility = () => {
      this.visibilityState = document.visibilityState;
      this.emit("visibility", document.visibilityState);
      if (document.visibilityState === "visible") this.feed?.play().catch(() => {});
    };
    document.addEventListener("visibilitychange", this.onDocumentVisibility);
    this.renderer.setAnimationLoop((time) => this.frame(time));
  }

  // Rozmiar planszy nie ma tu znaczenia: układ zawsze mieści się w oknie.
  placeBoard() {
    return super.placeBoard(1);
  }

  resize() {
    super.resize();
    this.aim();
  }

  // Postęp od 0 (plansza leży przed graczem) do 1 (rama stoi naprzeciw).
  setStanding(k) {
    this.standing = k;
    this.aim();
  }

  aim() {
    const { fov, lying, standing } = fixedView(this.camera.aspect, this.frontHomes);
    const mix = (key, axis) => lying[key][axis] + (standing[key][axis] - lying[key][axis]) * this.standing;
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
    this.camera.position.set(mix("position", "x"), mix("position", "y"), mix("position", "z"));
    this.camera.lookAt(mix("target", "x"), mix("target", "y"), mix("target", "z"));
    this.camera.updateMatrixWorld();
  }

  // Kamera gaśnie od razu po wyjściu z gry.
  stopCamera() {
    for (const track of this.stream?.getTracks() ?? []) track.stop();
    this.stream = null;
    this.feed?.remove();
    this.feed = null;
  }

  stop() {
    if (this.ended) return;
    if (this.onDocumentVisibility) document.removeEventListener("visibilitychange", this.onDocumentVisibility);
    this.stopCamera();
    super.stop();
  }
}

// Próba bez telefonu: szara podłoga, mysz zamiast palca, strzałki krążą kamerą.
class SimulatedSession extends CanvasSession {
  upright = true; // jak na telefonie z ARCore
  // Próba błędów startu: ?ar=symulacja&blad=denied albo unavailable, albo gesture.
  static nextError = new URLSearchParams(location.search).get("blad");

  async start() {
    if (SimulatedSession.nextError) {
      const code = SimulatedSession.nextError;
      SimulatedSession.nextError = null;
      throw Object.assign(new Error(`Symulowany błąd: ${code}`), { code });
    }
    this.scene.background = new THREE.Color(0x3c403c);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x7f837d }));
    floor.position.y = -0.002;
    this.scene.add(floor, new THREE.GridHelper(12, 24, 0x565a55, 0x6a6e68));
    this.orbit = { angle: 0, elevation: 0.6, radius: 2.6 };
    this.attachCanvas({ keydown: (event) => this.onKey(event) });
    this.moveCamera();
    this.renderer.setAnimationLoop((time) => this.frame(time));
  }

  frame(time) {
    const forward = this.camera.getWorldDirection(new THREE.Vector3());
    const tanHalfFovY = Math.tan((this.camera.fov * Math.PI) / 360);
    const quaternion = this.camera.quaternion.clone();
    this.view = { eye: this.camera.position.clone(), forward, quaternion, tanHalfFov: tanHalfFovY * this.camera.aspect, tanHalfFovY };
    super.frame(time);
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
    this.camera.lookAt(0, SIM_TARGET_Y, 0); // środek stojącej planszy
    this.camera.updateMatrixWorld();
  }
}

// Ustawia planszę względem wybranego punktu według boardPose. Tak samo ustawia się obrys przy stawianiu.
export function poseBoard(stand, board, tilt, pivotZ) {
  const { lift, back, offset } = boardPose(tilt, pivotZ);
  stand.rotation.x = tilt;
  stand.position.set(0, lift, back);
  board.position.set(offset.x, 0, offset.z);
}

// Three.js 0.170 rysuje przez XRProjectionLayer, gdy tylko sesja ma pole renderState.layers. Chrome 143 na Androidzie
// ma je także w sesji bez funkcji "layers", a wtedy obraz z tej warstwy nie trafia na ekran: każda klatka kończy się
// błędem GL_INVALID_FRAMEBUFFER_OPERATION i nie widać ani obrysu, ani planszy (OnePlus Nord 4, 9.11.2026).
// Specyfikacja pozwala na warstwy dopiero z funkcją "layers", więc bez niej Three.js wybiera XRWebGLLayer.
async function setSessionWithoutLayers(renderer, session) {
  if (session.enabledFeatures?.includes("layers")) return renderer.xr.setSession(session);
  // Pole czyta tylko setSession, więc zasłona znika zaraz po nim.
  Object.defineProperty(session, "renderState", {
    configurable: true,
    get() {
      const state = Reflect.get(Object.getPrototypeOf(session), "renderState", session);
      return new Proxy(state, { get: (target, key) => (key === "layers" ? undefined : Reflect.get(target, key)) });
    },
  });
  try {
    await renderer.xr.setSession(session);
  } finally {
    delete session.renderState;
  }
}

// Skąd i dokąd patrzy telefon w tej klatce. Kąty widzenia w poziomie i w pionie daje macierz rzutowania widoku.
function viewOf(pose) {
  const { position, orientation } = pose.transform;
  const quaternion = new THREE.Quaternion(orientation.x, orientation.y, orientation.z, orientation.w);
  const projection = pose.views?.[0]?.projectionMatrix;
  const tangent = (scale, fallback) => (scale > 0 ? 1 / scale : fallback);
  return {
    eye: new THREE.Vector3(position.x, position.y, position.z),
    forward: new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion),
    quaternion,
    tanHalfFov: tangent(projection?.[0], DEFAULT_TAN_HALF_FOV),
    tanHalfFovY: tangent(projection?.[5], DEFAULT_TAN_HALF_FOV * 2),
  };
}

// Przeglądarka zgłasza brak gestu jako SecurityError, a odmowę zgody jako NotAllowedError.
function errorCode(error) {
  if (error.name === "SecurityError" || /activation|gesture/i.test(error.message)) return "gesture";
  if (error.name === "NotAllowedError") return "denied";
  return "unavailable";
}

export function createSession(kind, overlayRoot) {
  if (kind === "symulacja") return new SimulatedSession(overlayRoot);
  if (kind === "kamera") return new CameraSession(overlayRoot);
  return new XrSession(overlayRoot);
}
