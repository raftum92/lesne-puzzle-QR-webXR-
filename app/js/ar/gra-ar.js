// Gra w trybie „W pokoju”: od szukania podłogi po informację o zwierzęciu.
import * as THREE from "../../vendor/three.module.min.js";
import { ANIMALS, nextAnimal } from "../zwierzeta.js";
import { LEVELS, pieceCount, piecesLabel } from "../poziomy.js";
import { createCuts } from "../ksztalty.js";
import { renderInfo } from "../info.js";
import { createSession } from "./sesja.js";
import { Animator } from "./animacje.js";
import { BOARD_H, BOARD_METERS, LIFT, planHomes, targetOf } from "./uklad.js";
import { Frame } from "./rama.js";
import { JUMP_FADE_MS, canJump, jumpDue } from "./skok.js";
import { Dragger } from "./przeciaganie.js";
import { createBoard, createPieceMesh, createShadowTexture } from "./elementy3d.js";

const OUTLINE_WIDTH = 0.012; // szerokość linii obrysu planszy, w jednostkach planszy
const MEMORIZE_MS = 1600; // chwila na obejrzenie całego obrazka, jak w gra.js
const PEEK_MS = 2500; // tyle widać cały obrazek po naciśnięciu „oka”
const FLY_MS = 850; // lot elementu przy rozsypaniu, jak w puzzle.js
const FLY_ARC = 0.15; // wysokość łuku przy rozsypaniu
const SNAP_MS = 150;
const PICKUP_MS = 170;
const RISE_MS = 1300; // wstawanie obrazu
const FILM_START_MS = 750; // film rusza, zanim obraz stanie, jak w gra.js
const LOWER_MS = 700; // obraz kładzie się z powrotem na planszę
const PLAY_TIMEOUT_MS = 8000; // przy zerwanej sieci play() może nigdy się nie skończyć, a w tej fazie nie ma przycisków
const SPACE_HINT_MS = 3000; // tyle widać przypomnienie o wolnym miejscu na początku
const NO_SURFACE_MS = 15000; // po takim czasie bez podłogi gra podpowiada, co zmienić
const HINT_SPACE = "Rozejrzyj się, czy masz wolne miejsce, i uważaj na przeszkody";
const HINT_SEARCH = "Powoli poruszaj telefonem, żeby znaleźć podłogę";
const HINT_NO_SURFACE = "Skieruj telefon na podłogę z wyraźnym wzorem i dobrym światłem";
const HINT_TRACKING = "Porusz telefonem, żeby znów zobaczyć podłogę";
const HINT_IMAGE = "Nie udało się wczytać obrazka. Sprawdź połączenie i spróbuj ponownie.";
const PIECE_Y = 0.002; // elementy leżą minimalnie nad planszą
const STACK_STEP = 0.0003; // każdy upuszczony element leży trochę wyżej, żeby nakładające się nie migotały
const STACK_LAYERS = 40;

const easeOut = (k) => 1 - (1 - k) ** 3;
const easeInOut = (k) => (k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2);
const once = (target, type) => new Promise((resolve) => target.addEventListener(type, resolve, { once: true }));

export class ArGame {
  constructor({ root, sounds, progress, video, kind, onExit, onNavigate, onStartError, sessionFactory = createSession }) {
    Object.assign(this, { root, sounds, progress, video, kind, onExit, onNavigate, onStartError, sessionFactory });
    const $ = (selector) => root.querySelector(selector);
    this.el = {
      title: $("#arTitle"),
      meta: $("#arMeta"),
      hint: $("#arHint"),
      meter: $("#arMeter"),
      meterText: $("#arMeterText"),
      sizes: $("#arSizes"),
      fps: $("#arFps"),
      start: $("#arStart"),
      playFallback: $("#arPlayFallback"),
      skip: $("#arSkip"),
      info: $("#arInfo"),
      live: $("#arLive"),
      confirm: $("#arConfirm"),
      confirmTitle: $("#arConfirmTitle"),
      confirmText: $("#arConfirmText"),
      confirmOk: $("#arConfirmOk"),
      confirmCancel: $("#arConfirmCancel"),
    };
    // Osobny element, żeby film ze skokiem ładował się w tle, kiedy gra jeszcze zwykły film.
    this.jumpVideo = document.createElement("video");
    this.jumpVideo.playsInline = true;
    this.jumpVideo.preload = "auto";
    this.token = 0;
    this.session = null;
    this.busy = false;
    this.timer = { running: false, elapsed: 0, since: null };
    this.stats = { picks: 0 };
    this.size = "podloga";
    this.debug = new URLSearchParams(location.search).get("debug") === "1";
    this.el.fps.hidden = !this.debug;
    this.animator = new Animator({ reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches });
    $('[data-action="back"]').addEventListener("click", () => this.requestExit());
    $('[data-action="peek"]').addEventListener("click", () => this.peek());
    $('[data-action="move-board"]').addEventListener("click", () => this.moveBoard());
    this.el.start.addEventListener("click", () => this.retry?.());
    this.el.confirmOk.addEventListener("click", () => this.confirmAnswer?.(true));
    this.el.confirmCancel.addEventListener("click", () => this.confirmAnswer?.(false));
    this.el.sizes.addEventListener("click", (event) => {
      const option = event.target.closest("[data-size]");
      if (option) this.selectSize(option.dataset.size);
    });
    // Dotknięcie przycisku nie może być jednocześnie dotknięciem podłogi.
    root.addEventListener("beforexrselect", (event) => {
      if (event.target.closest("button, a, .info, .ar__confirm")) event.preventDefault();
    });
    if (kind === "symulacja") window.__ar = { game: this };
  }

  get phase() {
    return this.root.dataset.phase;
  }

  set phase(phase) {
    this.root.dataset.phase = phase;
  }

  async start(animalId, levelId) {
    const token = ++this.token;
    this.level = LEVELS[levelId];
    this.stats.picks = 0;
    this.phase = "placing";
    this.setAnimal(animalId);
    this.setHint(HINT_SEARCH);
    this.selectSize(this.size);
    this.el.start.hidden = true;
    this.retry = null;
    let session;
    try {
      session = this.session = this.sessionFactory(this.kind, this.root);
      await session.start();
    } catch (error) {
      if (token !== this.token) return; // gracz wyszedł, zanim przeglądarka oddała sesję
      console.warn("Nie udało się uruchomić AR:", error.code, error.message);
      this.session = null;
      if (error.code === "gesture") return this.askForGesture(animalId, levelId);
      this.exit();
      this.onStartError?.();
      return;
    }
    if (token !== this.token) return session.stop();
    this.outline = createOutline();
    session.scene.add(this.outline);
    this.unsubscribe = [
      session.onFrame((time, tracking) => this.frame(time, tracking)),
      session.onPointer((type, ray, id) => this.pointer(type, ray, id)),
      session.onEnd(() => this.sessionEnded()),
      session.onVisibility((state) => this.onVisibility(state)),
    ];
  }

  // Przeglądarka odrzuciła sesję, bo minęło za dużo czasu od dotknięcia: wystarczy jeszcze jedno.
  askForGesture(animalId, levelId) {
    this.phase = "start";
    this.setHint("");
    this.el.start.hidden = false;
    this.retry = () => this.start(animalId, levelId);
  }

  setAnimal(animalId) {
    this.animal = ANIMALS[animalId];
    this.el.title.textContent = this.animal.name;
    this.el.meta.textContent = `Poziom ${this.level.name.toLowerCase()} · ${piecesLabel(pieceCount(this.level))}`;
    this.renderMeter(0);
    // Film ładuje się w tle, kiedy gracz układa puzzle.
    this.video.preload = "auto";
    this.video.src = this.animal.arVideo;
    if (this.jumpAllowed()) {
      this.jumpVideo.src = this.animal.jump.video;
    } else {
      this.jumpVideo.removeAttribute("src");
      this.jumpVideo.load?.();
    }
  }

  jumpAllowed() {
    return canJump(this.animal, { reducedMotion: this.animator.reducedMotion });
  }

  frame(time, tracking) {
    this.animator.update(time);
    this.countFrame(time);
    if (this.jumpArmed && jumpDue(this.video.currentTime, this.video.duration)) this.beginJump();
    if (this.phase === "placing") this.updateOutline(time);
    if (this.dragger) {
      this.dragger.enabled = tracking;
      if (!tracking) this.dragger.cancel();
    }
    if (tracking !== this.tracking) {
      this.tracking = tracking;
      if (this.phase === "puzzle") this.setHint(tracking ? "" : HINT_TRACKING);
    }
  }

  // Obrys podąża za znalezioną powierzchnią i ma rzeczywisty rozmiar planszy.
  updateOutline(time) {
    const { surface } = this.session;
    this.placingSince ??= time;
    this.lastSurface ??= time;
    if (surface) this.lastSurface = time;
    this.outline.visible = Boolean(surface);
    this.setHint(this.placingHint(time, surface));
    if (!surface) return;
    this.outline.position.copy(surface.position);
    this.outline.rotation.y = surface.yaw;
    this.outline.scale.setScalar(BOARD_METERS[this.size]);
  }

  placingHint(time, surface) {
    if (!this.boardPlaced && time - this.placingSince < SPACE_HINT_MS) return HINT_SPACE;
    if (surface) return "Dotknij ekranu, żeby postawić planszę";
    return time - this.lastSurface > NO_SURFACE_MS ? HINT_NO_SURFACE : HINT_SEARCH;
  }

  pointer(type, ray, id) {
    if (this.phase === "puzzle") this.dragger?.pointer(type, ray, id);
    else if (type === "down" && this.phase === "placing" && this.session.surface) {
      if (this.boardPlaced) this.finishMove();
      else this.place();
    }
  }

  async place() {
    const token = this.token;
    this.board = this.session.placeBoard(BOARD_METERS[this.size]);
    this.boardPlaced = true;
    this.outline.visible = false;
    this.phase = "intro";
    this.setHint("Przyjrzyj się obrazkowi");
    const image = await loadImage(this.animal.image).catch(() => null);
    if (token !== this.token) return;
    if (!image) return this.setHint(HINT_IMAGE);
    this.image = image;
    this.frameObject = new Frame({ parent: this.board, animator: this.animator, image });
    await this.frameObject.show(400);
    if (token === this.token) await this.memorize(token);
  }

  // Ułożony obrazek rozsypuje się: elementy odlatują łukiem na swoje miejsca obok planszy.
  async shatter(token) {
    this.buildPuzzle();
    this.frameObject.hide(200);
    const stagger = Math.min(70, 900 / this.pieces.length);
    this.sounds.shatter(this.pieces.length, stagger / 1000);
    this.setHint("");
    await Promise.all(this.pieces.map((piece, i) => this.fly(piece, i * stagger)));
    if (token !== this.token) return;
    this.phase = "puzzle";
    this.setHint("Przeciągnij elementy na planszę");
    this.startTimer();
  }

  buildPuzzle() {
    const { level, image } = this;
    this.cuts = createCuts(level.cols, level.rows);
    this.puzzleBoard = createBoard(this.cuts, level, image);
    this.board.add(this.puzzleBoard.group);
    this.pieceTexture ??= new THREE.Texture(image);
    this.pieceTexture.image = image;
    this.pieceTexture.colorSpace = THREE.SRGBColorSpace;
    this.pieceTexture.anisotropy = 4; // elementy widać pod ostrym kątem, leżą na podłodze
    this.pieceTexture.needsUpdate = true;
    this.shadowTexture ??= createShadowTexture();
    const homes = planHomes(level);
    this.stack = 0;
    this.pieces = [];
    for (let r = 0; r < level.rows; r++) {
      for (let c = 0; c < level.cols; c++) {
        const index = this.pieces.length;
        const group = createPieceMesh(this.cuts, r, c, level, this.pieceTexture, this.shadowTexture);
        const piece = { r, c, index, group, home: homes[index], placed: false, y: PIECE_Y, rot: 0, ...targetOf(r, c, level) };
        this.board.add(group);
        this.pieces.push(piece);
        this.render(piece);
      }
    }
    this.dragger = new Dragger({
      pieces: this.pieces,
      level,
      toBoard: (ray) => this.toBoard(ray),
      onPick: (piece) => this.onPick(piece),
      onMove: (piece) => this.render(piece),
      onNear: (piece) => this.puzzleBoard.setNear(piece ? piece.index : null),
      onSnap: (piece) => this.onSnap(piece),
      onDrop: (piece) => this.onDrop(piece),
    });
    this.dragger.enabled = true;
  }

  async fly(piece, delay) {
    await this.wait(delay);
    const from = { x: piece.x, z: piece.z };
    const { x, z, rot } = piece.home;
    await this.animator.add(
      FLY_MS,
      (e) => {
        piece.x = from.x + (x - from.x) * e;
        piece.z = from.z + (z - from.z) * e;
        piece.y = PIECE_Y + Math.sin(Math.PI * e) * FLY_ARC;
        piece.rot = rot * e;
        this.render(piece);
      },
      easeInOut,
    );
  }

  render(piece) {
    piece.group.position.set(piece.x, piece.y, piece.z);
    piece.group.rotation.y = piece.rot;
    // Cień jaśnieje, gdy element jest w górze, i zawsze leży na podłodze.
    const { shadow } = piece.group.userData;
    shadow.position.y = 0.0015 - piece.y;
    shadow.material.opacity = 0.45 * (1 - Math.min(1, (piece.y - PIECE_Y) / (LIFT * 2)));
  }

  // Promień z układu sceny do układu planszy.
  toBoard({ origin, direction }) {
    this.board.updateWorldMatrix(true, false);
    const inverse = this.board.matrixWorld.clone().invert();
    return {
      origin: origin.clone().applyMatrix4(inverse),
      direction: direction.clone().transformDirection(inverse),
    };
  }

  onPick(piece) {
    this.sounds.pick();
    this.stats.picks++;
    this.setHint("");
    const fromY = piece.y;
    const fromRot = piece.rot;
    piece.y = PIECE_Y + LIFT;
    this.animator.add(
      PICKUP_MS,
      (e) => {
        if (this.dragger?.drag?.piece !== piece) return; // ostatni element mógł już zakończyć układanie
        piece.y = fromY + (PIECE_Y + LIFT - fromY) * e;
        piece.rot = fromRot * (1 - e);
        this.render(piece);
      },
      easeOut,
    );
  }

  onDrop(piece) {
    this.stack = (this.stack + 1) % STACK_LAYERS;
    this.settle(piece, PIECE_Y + this.stack * STACK_STEP);
  }

  onSnap(piece) {
    this.sounds.snap();
    // Wibracja działa tylko po dotknięciu ekranu przez gracza; bez tego Chrome zgłasza błąd.
    if (navigator.userActivation?.hasBeenActive !== false) navigator.vibrate?.(12);
    this.puzzleBoard.setFilled(piece.index);
    piece.rot = 0;
    this.settle(piece, PIECE_Y);
    const count = this.placedCount;
    this.renderMeter(count);
    this.el.live.textContent = `Element na miejscu. Ułożone ${count} z ${this.pieces.length}.`;
    if (count === this.pieces.length) this.complete();
  }

  get placedCount() {
    return this.pieces?.filter((piece) => piece.placed).length ?? 0;
  }

  settle(piece, y) {
    const fromY = piece.y;
    this.animator.add(
      SNAP_MS,
      (e) => {
        piece.y = fromY + (y - fromY) * e;
        this.render(piece);
      },
      easeOut,
    );
  }

  peek() {
    if (this.phase !== "puzzle") return;
    clearTimeout(this.peekTimer);
    this.puzzleBoard.setPeek(true);
    this.peekTimer = setTimeout(() => this.puzzleBoard?.setPeek(false), PEEK_MS);
  }

  // Przeniesienie całej planszy razem z elementami: obrys wraca, a dotknięcie stawia planszę w nowym miejscu.
  moveBoard() {
    if (this.phase !== "puzzle") return;
    this.dragger.cancel();
    this.lastSurface = null;
    this.phase = "placing";
  }

  finishMove() {
    this.session.placeBoard(BOARD_METERS[this.size]);
    this.outline.visible = false;
    this.setHint("");
    this.phase = "puzzle";
  }

  async complete() {
    const token = this.token;
    const seconds = this.stopTimer();
    const { animal, level } = this;
    const saved = this.progress.record(animal.id, level.id, seconds);
    this.el.live.textContent = `Obrazek ułożony! ${animal.name} ożywa.`;
    this.renderInfoPanel({ seconds, level, ...saved });
    this.dragger = null;
    this.phase = "reveal";
    this.setHint("");
    await this.reveal(token);
  }

  renderInfoPanel(result) {
    renderInfo(this.el.info, this.animal, {
      result,
      next: ANIMALS[nextAnimal(this.animal.id)],
      onNext: () => this.next(),
      onReplay: () => this.replay(),
      onAgain: () => this.again(),
    });
  }

  // Szwy znikają, obraz wstaje z podłogi, a w locie zaczyna się ruszać.
  async reveal(token) {
    await this.wait(450); // błysk ostatniego elementu
    if (token !== this.token) return;
    this.sounds.shimmer();
    await this.frameObject.show(800);
    await this.wait(450);
    if (token !== this.token) return;
    this.clearPuzzle();
    this.sounds.whoosh(RISE_MS / 1000);
    this.sounds.stopAmbience(2); // film ma własne tło lasu
    this.frameObject.rise(RISE_MS);
    await this.wait(FILM_START_MS);
    if (token !== this.token) return;
    const playing = await this.playFilm(token);
    if (token !== this.token) return;
    if (!playing) {
      // Bez filmu (brak sieci, nieobsługiwany format) informacja pojawia się na samym obrazie.
      await this.wait(800);
      if (token === this.token) this.showInfo();
      return;
    }
    await this.watchFilm(token);
  }

  // Elementy i plansza znikają, kiedy zasłania je już cały obraz.
  clearPuzzle() {
    clearTimeout(this.peekTimer);
    for (const piece of this.pieces ?? []) disposeObject(piece.group);
    this.pieces = null;
    if (this.puzzleBoard) disposeObject(this.puzzleBoard.group);
    this.puzzleBoard = null;
    this.dragger = null;
  }

  async playFilm(token) {
    const { video } = this;
    const { playFallback } = this.el;
    if (video.error) return false;
    video.currentTime = 0;
    try {
      await this.startVideo();
    } catch (error) {
      if (token !== this.token || error.name !== "NotAllowedError") {
        video.pause();
        return false;
      }
      // Przeglądarka zablokowała odtwarzanie z dźwiękiem: wystarczy jedno kliknięcie.
      playFallback.hidden = false;
      await once(playFallback, "click");
      playFallback.hidden = true;
      if (token !== this.token) return false;
      try {
        await this.startVideo();
      } catch {
        video.pause();
        return false;
      }
    }
    if (token !== this.token) {
      video.pause();
      return false;
    }
    this.frameObject.play(video);
    return true;
  }

  startVideo(video = this.video) {
    const timeout = this.wait(PLAY_TIMEOUT_MS).then(() => {
      throw new Error("Film nie ruszył");
    });
    return Promise.race([video.play(), timeout]);
  }

  // Czeka na koniec filmu. Zwraca true, gdy film pominięto albo przerwano grę.
  waitForFilm(video) {
    const { skip } = this.el;
    this.filmWait?.abort();
    const controller = (this.filmWait = new AbortController());
    return new Promise((resolve) => {
      const options = { once: true, signal: controller.signal };
      video.addEventListener("ended", () => resolve(false), options);
      skip.addEventListener("click", () => resolve(true), options);
      controller.signal.addEventListener("abort", () => resolve(true), { once: true });
    }).finally(() => controller.abort());
  }

  // Pod koniec zwykłego filmu zwierzę wyskakuje z ramy. Uruchamia to pętla AR albo najpóźniej koniec filmu.
  beginJump() {
    this.jumpArmed = false;
    return (this.jumpStart ??= this.startJump());
  }

  async startJump() {
    const run = (this.jumpRun = new AbortController());
    const { jumpVideo } = this;
    jumpVideo.currentTime = 0;
    jumpVideo.muted = this.video.muted;
    if (!(await this.playJumpVideo(run))) return false;
    await nextFrame(jumpVideo);
    if (run.signal.aborted) return false;
    this.frameObject.showJump(jumpVideo, JUMP_FADE_MS);
    this.vibrateOnJump(run.signal);
    return true;
  }

  // Bez dźwięku, jeśli przeglądarka go zablokuje.
  async playJumpVideo(run) {
    const { jumpVideo } = this;
    try {
      await this.startVideo(jumpVideo);
      return true;
    } catch (error) {
      if (!run.signal.aborted && error.name === "NotAllowedError") {
        jumpVideo.muted = true;
        try {
          await this.startVideo(jumpVideo);
          return true;
        } catch {
          // niżej: bez skoku
        }
      }
      jumpVideo.pause();
      return false;
    }
  }

  // Krótka wibracja w chwili wycia. Działa tylko po dotknięciu ekranu przez gracza.
  vibrateOnJump(signal) {
    const { vibrateAt } = this.animal.jump;
    const { jumpVideo } = this;
    let done = false;
    jumpVideo.addEventListener(
      "timeupdate",
      () => {
        if (done || jumpVideo.currentTime < vibrateAt) return;
        done = true;
        if (navigator.userActivation?.hasBeenActive !== false) navigator.vibrate?.(200);
      },
      { signal },
    );
  }

  // Zatrzymuje skok, także uruchamiany. Następny film może go zacząć od nowa.
  cancelJump() {
    this.jumpArmed = false;
    this.jumpRun?.abort();
    this.jumpStart = null;
    this.jumpVideo.pause();
    this.frameObject?.hideJump();
  }

  async watchFilm(token) {
    const { video, jumpVideo } = this;
    this.phase = "video";
    this.jumpArmed = this.jumpAllowed();
    const skipped = await this.waitForFilm(video);
    this.jumpArmed = false;
    if (token !== this.token) return;
    if (skipped) {
      this.cancelJump();
      video.pause();
      if (Number.isFinite(video.duration)) video.currentTime = Math.max(0, video.duration - 0.05);
    } else if (this.jumpAllowed()) {
      const started = await this.beginJump();
      if (token !== this.token) return;
      if (started) await this.waitForFilm(jumpVideo);
      if (token !== this.token) return;
      jumpVideo.pause();
      this.jumpStart = null;
    }
    this.showInfo();
  }

  showInfo() {
    this.phase = "info";
    this.sounds.startAmbience(4);
    const token = this.token;
    setTimeout(() => {
      if (token !== this.token || this.phase !== "info") return;
      this.el.info.classList.add("is-visible");
      this.el.info.querySelector(".info__title")?.focus({ preventScroll: true });
    }, this.animator.reducedMotion ? 0 : 600);
  }

  async replay() {
    if (this.busy) return;
    this.busy = true;
    const token = this.token;
    this.el.info.classList.remove("is-visible");
    this.sounds.stopAmbience(1.2);
    this.cancelJump();
    const playing = await this.playFilm(token);
    this.busy = false;
    if (token !== this.token) return;
    if (!playing) return this.showInfo();
    await this.watchFilm(token);
  }

  // Ten sam obrazek od nowa, z nowymi kształtami elementów.
  async again() {
    if (this.busy) return;
    this.busy = true;
    const token = ++this.token;
    this.renderMeter(0);
    await this.layDown(token, this.image);
    this.busy = false;
    if (token === this.token) await this.memorize(token);
  }

  async next() {
    if (this.busy) return;
    this.busy = true;
    const token = ++this.token;
    const id = nextAnimal(this.animal.id);
    this.onNavigate?.(id);
    this.cancelJump();
    this.setAnimal(id);
    const image = await loadImage(this.animal.image).catch(() => null);
    if (token !== this.token) return;
    if (!image) {
      this.busy = false;
      this.el.info.classList.remove("is-visible");
      this.phase = "intro";
      return this.setHint(HINT_IMAGE);
    }
    this.image = image;
    await this.layDown(token, image);
    // Panel znika przez pół sekundy i wciąż da się go dotknąć, więc blokada trwa do końca kładzenia.
    this.busy = false;
    if (token === this.token) await this.memorize(token);
  }

  // Panel znika, a obraz kładzie się z powrotem na planszę. W połowie ruchu film zmienia się w obrazek.
  async layDown(token, image) {
    const { info } = this.el;
    info.classList.remove("is-visible");
    this.phase = "intro";
    this.video.pause();
    this.cancelJump();
    this.sounds.startAmbience(2);
    this.frameObject.lower(LOWER_MS);
    await this.wait(LOWER_MS / 2);
    if (token !== this.token) return;
    this.frameObject.showImage(image);
    await this.wait(LOWER_MS / 2);
  }

  async memorize(token) {
    this.setHint("Przyjrzyj się obrazkowi");
    await this.wait(MEMORIZE_MS);
    if (token === this.token) await this.shatter(token);
  }

  // Czas liczony w pętli AR; kończy się też po przerwaniu gry.
  wait(ms) {
    return this.animator.add(ms, () => {});
  }

  selectSize(id) {
    this.size = id;
    for (const option of this.el.sizes.querySelectorAll("[data-size]")) {
      option.setAttribute("aria-checked", String(option.dataset.size === id));
    }
  }

  setHint(text) {
    if (this.el.hint.textContent !== text) this.el.hint.textContent = text;
  }

  renderMeter(count) {
    const total = pieceCount(this.level);
    const { meter, meterText } = this.el;
    if (meter.children.length !== total) meter.innerHTML = "<i></i>".repeat(total);
    [...meter.children].forEach((segment, i) => segment.classList.toggle("is-on", i < count));
    meterText.textContent = `${count}/${total}`;
  }

  countFrame(time) {
    if (!this.debug) return;
    this.fpsFrames = (this.fpsFrames ?? 0) + 1;
    this.fpsSince ??= time;
    if (time - this.fpsSince < 1000) return;
    this.el.fps.textContent = `${Math.round((this.fpsFrames * 1000) / (time - this.fpsSince))} kl./s`;
    this.fpsFrames = 0;
    this.fpsSince = time;
  }

  // Czas układania liczy się tylko wtedy, gdy sesja jest widoczna.
  startTimer() {
    this.timer = { running: true, elapsed: 0, since: this.hidden ? null : performance.now() };
  }

  stopTimer() {
    const { timer } = this;
    if (timer.running && timer.since !== null) timer.elapsed += performance.now() - timer.since;
    timer.running = false;
    timer.since = null;
    return timer.elapsed / 1000;
  }

  onVisibility(state) {
    this.hidden = state !== "visible";
    const { timer, video } = this;
    if (this.hidden) this.dragger?.cancel();
    if (timer.running) {
      if (this.hidden && timer.since !== null) {
        timer.elapsed += performance.now() - timer.since;
        timer.since = null;
      } else if (!this.hidden) {
        timer.since = performance.now();
      }
    }
    // Film zatrzymuje się razem ze schowaną sesją i rusza po powrocie.
    if (this.hidden && this.phase === "video" && !video.paused) {
      this.resumeVideo = true;
      video.pause();
    } else if (!this.hidden && this.resumeVideo) {
      this.resumeVideo = false;
      if (this.phase === "video") video.play().catch(() => {});
    }
  }

  // Wyjście do menu. W trakcie układania pyta, czy na pewno porzucić ułożone elementy.
  async requestExit() {
    if (this.dragger && this.placedCount > 0) {
      const leave = await this.ask({
        title: "Przerwać układanie?",
        text: `Ułożone elementy (${this.placedCount} z ${this.pieces.length}) nie zostaną zapamiętane.`,
        confirm: "Wyjdź do menu",
        cancel: "Układam dalej",
      });
      if (!leave) return this.session === null; // sesja mogła się w tym czasie sama zakończyć
    }
    this.exit();
    return true;
  }

  // Zwykły <dialog> leży poza warstwą AR i nie byłby widoczny, więc pytamy w jej środku.
  ask({ title, text, confirm, cancel }) {
    const { el } = this;
    this.confirmAnswer?.(false);
    el.confirmTitle.textContent = title;
    el.confirmText.textContent = text;
    el.confirmOk.textContent = confirm;
    el.confirmCancel.textContent = cancel;
    el.confirm.hidden = false;
    return new Promise((resolve) => {
      this.confirmAnswer = (answer) => {
        el.confirm.hidden = true;
        this.confirmAnswer = null;
        resolve(answer);
      };
    });
  }

  // System sam zakończył sesję, na przykład po zablokowaniu ekranu.
  sessionEnded() {
    if (this.session) this.exit();
  }

  exit() {
    this.stop();
    this.onExit();
  }

  stop() {
    this.token++;
    this.busy = false;
    this.boardPlaced = false;
    this.placingSince = null;
    this.lastSurface = null;
    this.tracking = true;
    this.hidden = false;
    this.retry = null;
    this.el.start.hidden = true;
    this.resumeVideo = false;
    this.stopTimer();
    this.animator.clear();
    this.filmWait?.abort();
    this.video.pause();
    this.cancelJump();
    this.el.playFallback.hidden = true;
    this.el.info.classList.remove("is-visible");
    this.confirmAnswer?.(false);
    this.clearPuzzle();
    this.frameObject?.dispose();
    this.frameObject = null;
    this.pieceTexture?.dispose();
    this.pieceTexture = null;
    this.shadowTexture?.dispose();
    this.shadowTexture = null;
    this.setHint("");
    this.phase = "idle";
    for (const unsubscribe of this.unsubscribe ?? []) unsubscribe();
    this.unsubscribe = null;
    const session = this.session;
    this.session = null;
    session?.stop();
  }
}

function nextFrame(media) {
  return new Promise((resolve) => {
    if (media.requestVideoFrameCallback) media.requestVideoFrameCallback(() => resolve());
    else setTimeout(resolve, 60);
  });
}

async function loadImage(src) {
  const image = new Image();
  image.src = src;
  await image.decode();
  return image;
}

function disposeObject(root) {
  root.removeFromParent();
  root.traverse((object) => {
    object.geometry?.dispose();
    for (const material of [object.material].flat()) {
      material?.map?.dispose();
      material?.dispose();
    }
  });
}

// Prostokątny obrys planszy z czterech pasków leżących na podłodze; początek układu to jego środek.
function createOutline() {
  const group = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
  const bar = (width, depth, x, z) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth).rotateX(-Math.PI / 2), material);
    mesh.position.set(x, 0.002, z);
    group.add(mesh);
  };
  bar(1, OUTLINE_WIDTH, 0, -BOARD_H / 2);
  bar(1, OUTLINE_WIDTH, 0, BOARD_H / 2);
  bar(OUTLINE_WIDTH, BOARD_H, -0.5, 0);
  bar(OUTLINE_WIDTH, BOARD_H, 0.5, 0);
  group.visible = false;
  return group;
}
