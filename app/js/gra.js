// Ekran gry: puzzle z wybranym zwierzęciem, ożywający obraz i informacja o zwierzęciu.
import { ANIMALS, nextAnimal } from "./zwierzeta.js";
import { LEVELS, pieceCount, piecesLabel } from "./poziomy.js";
import { Puzzle, planLayout } from "./puzzle.js";
import { renderInfo } from "./info.js";

const MEMORIZE_MS = 1600; // chwila na obejrzenie całego obrazka, zanim się rozsypie
const PEEK_MS = 2500; // tyle widać cały obrazek po naciśnięciu „oka”

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, reducedMotion ? Math.min(ms, 300) : ms));
const once = (target, type) => new Promise((resolve) => target.addEventListener(type, resolve, { once: true }));

export class Game {
  constructor({ root, sounds, progress, backdrop, confirm, oneAnimal = false, onExit, onNavigate }) {
    Object.assign(this, { root, sounds, progress, backdrop, confirm, oneAnimal, onExit, onNavigate });
    const $ = (selector) => root.querySelector(selector);
    this.el = {
      topbar: $(".topbar"),
      title: $("#gameTitle"),
      meta: $("#gameMeta"),
      hint: $("#gameHint"),
      meter: $("#meter"),
      meterText: $("#meterText"),
      table: $("#table"),
      tray: $("#tray"),
      ghost: $("#ghost"),
      slots: $("#slots"),
      peek: $("#peek"),
      stage: $("#stage"),
      photo: $("#photo"),
      video: $("#video"),
      playFallback: $("#playFallback"),
      skip: $("#skipFilm"),
      info: $("#info"),
      live: $("#gameLive"),
    };
    this.token = 0; // każda nowa gra albo wyjście unieważnia trwające animacje i oczekiwania
    this.puzzle = null;
    this.busy = false;
    this.timer = { running: false, elapsed: 0, since: null };
    $('[data-action="back"]').addEventListener("click", () => this.requestExit());
    $('[data-action="peek"]').addEventListener("click", () => this.peek());
    addEventListener("resize", () => {
      cancelAnimationFrame(this.resizeFrame);
      this.resizeFrame = requestAnimationFrame(() => this.layout());
    });
    document.addEventListener("visibilitychange", () => this.onVisibility());
  }

  get phase() {
    return this.root.dataset.phase;
  }

  set phase(phase) {
    this.root.dataset.phase = phase;
  }

  // Nowa gra. `from` to miejsce miniatury w menu: obrazek przelatuje z niej na planszę.
  async start(animalId, levelId, from = null) {
    const token = ++this.token;
    const animal = (this.animal = ANIMALS[animalId]);
    const level = (this.level = LEVELS[levelId]);
    const { video, table, tray } = this.el;
    this.busy = false;
    this.phase = "intro";
    this.resetStage();
    this.el.info.classList.remove("is-visible");
    this.el.title.textContent = animal.name;
    this.el.meta.textContent = `Poziom ${level.name.toLowerCase()} · ${piecesLabel(pieceCount(level))}`;
    this.setHint("Przyjrzyj się obrazkowi");
    this.renderMeter(0);
    this.backdrop.set(animal.thumb);
    // Film ładuje się w tle, kiedy gracz układa puzzle.
    video.preload = "auto";
    video.src = animal.video;
    this.el.photo.src = animal.image;
    this.el.peek.src = animal.image;
    this.puzzle?.destroy();
    this.puzzle = null;
    tray.classList.remove("is-ready", "is-peeking");
    table.classList.remove("is-hidden");

    const top = this.el.topbar.offsetHeight;
    const plan = planLayout(table.clientWidth, table.clientHeight, top, level.cols, level.rows);
    const placeholder = this.placeholder(animal, { x: plan.bx, y: plan.by, w: plan.bw, h: plan.bh }, from);
    const image = await loadImage(animal.image).catch(() => null);
    await placeholder.ready;
    if (token !== this.token) return placeholder.remove();
    if (!image) {
      // Bez obrazka nie ma czego układać: zostaje miniatura i wyraźna informacja.
      this.setHint("Nie udało się wczytać obrazka. Sprawdź połączenie i spróbuj ponownie.");
      return;
    }

    this.puzzle = new Puzzle({
      table,
      tray,
      ghost: this.el.ghost,
      slots: this.el.slots,
      image,
      cols: level.cols,
      rows: level.rows,
      snap: level.snap,
      hints: level.hints,
      onPick: () => this.sounds.pick(),
      onSnap: (count) => this.snapped(count),
      onComplete: () => this.complete(),
    });
    tray.style.setProperty("--ghost-opacity", level.ghost);
    tray.classList.toggle("is-mono", level.mono);
    this.layout();
    placeholder.remove(true);
    await wait(MEMORIZE_MS);
    if (token !== this.token) return;
    await this.shatter(token);
  }

  // Obrazek na miejscu planszy, zanim powstaną elementy: przylatuje z menu albo się pojawia.
  placeholder(animal, board, from) {
    const img = document.createElement("img");
    img.className = "flyer";
    img.alt = "";
    img.src = animal.thumb;
    img.style.objectPosition = animal.focus;
    const place = (rect, radius) => ({
      left: `${rect.x}px`,
      top: `${rect.y}px`,
      width: `${rect.w}px`,
      height: `${rect.h}px`,
      borderRadius: `${radius}px`,
    });
    Object.assign(img.style, place(board, 3));
    this.root.append(img);
    let animation;
    if (from && !reducedMotion) {
      animation = img.animate([place(from.rect, from.radius), place(board, 3)], {
        duration: 720,
        easing: "cubic-bezier(0.65, 0, 0.35, 1)",
      });
    } else {
      animation = img.animate(
        [
          { opacity: 0, transform: "scale(0.97)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: reducedMotion ? 1 : 500, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
      );
    }
    // W schowanej karcie animacje stoją; gra nie może przez to utknąć na obrazku.
    const timeout = new Promise((resolve) => setTimeout(resolve, 1200));
    return {
      ready: Promise.race([animation.finished.catch(() => {}), timeout]),
      remove: (fade = false) => {
        if (!fade) return img.remove();
        img.classList.add("is-gone");
        setTimeout(() => img.remove(), 400);
      },
    };
  }

  async shatter(token) {
    this.phase = "puzzle";
    this.setHint("Przeciągnij elementy na planszę");
    this.sounds.shatter(this.puzzle.pieces.length, this.puzzle.stagger / 1000);
    await this.puzzle.scatter();
    if (token !== this.token) return;
    this.el.tray.classList.add("is-ready");
    this.startTimer();
  }

  snapped(count) {
    const total = this.puzzle.pieces.length;
    this.sounds.snap();
    // Wibracja działa tylko po dotknięciu ekranu przez gracza; bez tego Chrome zgłasza błąd.
    if (navigator.userActivation?.hasBeenActive !== false) navigator.vibrate?.(12);
    this.renderMeter(count);
    this.el.hint.classList.add("is-hidden");
    this.el.live.textContent = `Element na miejscu. Ułożone ${count} z ${total}.`;
  }

  async complete() {
    const token = this.token;
    const seconds = this.stopTimer();
    const { animal, level } = this;
    const saved = this.progress.record(animal.id, level.id, seconds);
    this.el.live.textContent = `Obrazek ułożony! ${animal.name} ożywa.`;
    renderInfo(this.el.info, animal, {
      result: { seconds, level, ...saved },
      next: this.oneAnimal ? null : ANIMALS[nextAnimal(animal.id)],
      onNext: () => this.next(),
      onReplay: () => this.replay(),
      onAgain: () => this.again(),
    });
    await this.reveal(token);
  }

  // Ostatni element na miejscu: szwy znikają, obraz rośnie na cały ekran i w locie zaczyna się ruszać.
  async reveal(token) {
    const { stage, table } = this.el;
    this.phase = "reveal";
    const board = this.puzzle.boardRect();
    const full = this.stageRect();
    this.placeStage(full);
    stage.style.setProperty("--shift", `${this.animal.shift * 100}%`);
    stage.style.setProperty("--zoom", 1.06 + this.animal.shift * 2);
    stage.style.transition = "none";
    stage.style.transform = `translate(${board.x - full.x}px, ${board.y - full.y}px) scale(${board.w / full.w})`;
    stage.classList.add("is-visible");
    await wait(450); // błysk ostatniego elementu
    if (token !== this.token) return;
    this.sounds.shimmer();
    stage.classList.add("is-merged");
    await wait(1250);
    if (token !== this.token) return;
    table.classList.add("is-hidden");
    this.sounds.whoosh(1.3);
    this.sounds.stopAmbience(2); // film ma własne tło lasu
    stage.getBoundingClientRect(); // przejście ma ruszyć z pozycji planszy
    stage.style.transition = `transform ${reducedMotion ? 0.01 : 1.3}s cubic-bezier(0.65, 0, 0.35, 1)`;
    stage.style.transform = "none";
    // Film rusza, kiedy obraz jeszcze leci i zwalnia. Ruch kamery ukrywa chwilę, w której zdjęcie
    // zaczyna się ruszać, więc nie ma momentu „stoi zdjęcie, a potem nagle startuje film”.
    await wait(750);
    if (token !== this.token) return;
    const playing = await this.playFilm(token);
    if (token !== this.token) return;
    if (!playing) {
      // Bez filmu (brak sieci, nieobsługiwany format) informacja pojawia się na samym zdjęciu.
      await wait(800);
      if (token === this.token) this.showInfo();
      return;
    }
    stage.classList.add("is-alive");
    await this.watchFilm(token);
  }

  async playFilm(token) {
    const { video, playFallback } = this.el;
    if (video.error) return false;
    video.currentTime = 0;
    try {
      await video.play();
    } catch (error) {
      if (token !== this.token || error.name !== "NotAllowedError") return false;
      // Przeglądarka zablokowała odtwarzanie z dźwiękiem: wystarczy jedno kliknięcie.
      playFallback.hidden = false;
      await once(playFallback, "click");
      playFallback.hidden = true;
      if (token !== this.token) return false;
      try {
        await video.play();
      } catch {
        return false;
      }
    }
    await nextFrame(video);
    return true;
  }

  async watchFilm(token) {
    const { video, skip } = this.el;
    this.phase = "video";
    this.filmWait?.abort();
    const controller = (this.filmWait = new AbortController());
    const skipped = await new Promise((resolve) => {
      const options = { once: true, signal: controller.signal };
      video.addEventListener("ended", () => resolve(false), options);
      skip.addEventListener("click", () => resolve(true), options);
    });
    controller.abort();
    if (token !== this.token) return;
    if (skipped) {
      video.pause();
      if (Number.isFinite(video.duration)) video.currentTime = Math.max(0, video.duration - 0.05);
    }
    this.showInfo();
  }

  showInfo() {
    this.phase = "info";
    this.el.stage.classList.add("is-ended");
    this.sounds.startAmbience(4);
    const token = this.token;
    setTimeout(
      () => {
        if (token !== this.token || this.phase !== "info") return;
        this.el.info.classList.add("is-visible");
        this.el.info.querySelector(".info__title")?.focus({ preventScroll: true });
      },
      reducedMotion ? 0 : 600,
    );
  }

  // Powtórka bez nieruchomego kadru: ostatnia klatka rozpływa się prosto w ruch od początku filmu.
  async replay() {
    if (this.busy) return;
    this.busy = true;
    const token = this.token;
    const { info, stage, video } = this.el;
    info.classList.remove("is-visible");
    this.sounds.stopAmbience(1.2);
    const still = freezeFrame(video);
    const playing = await this.playFilm(token);
    if (token !== this.token) return still.remove();
    if (!playing) {
      still.remove();
      this.busy = false;
      return this.showInfo();
    }
    stage.classList.remove("is-ended"); // przybliżenie i przyciemnienie wracają do normy razem z przenikaniem
    still.getBoundingClientRect();
    still.classList.add("is-dissolving");
    setTimeout(() => still.remove(), 1300);
    this.busy = false;
    await this.watchFilm(token);
  }

  // Ten sam obrazek od nowa, z nowymi kształtami elementów.
  async again() {
    if (this.busy) return;
    this.busy = true;
    const token = ++this.token;
    const { info, stage, video, tray, table } = this.el;
    info.classList.remove("is-visible");
    stage.classList.add("is-leaving");
    this.phase = "intro";
    await wait(700);
    if (token !== this.token) return;
    video.pause();
    this.resetStage();
    this.puzzle.reset();
    this.layout();
    this.renderMeter(0);
    this.setHint("Przyjrzyj się obrazkowi");
    tray.classList.remove("is-ready");
    table.classList.remove("is-hidden");
    this.sounds.startAmbience(2);
    await wait(MEMORIZE_MS);
    if (token !== this.token) return;
    this.busy = false;
    await this.shatter(token);
  }

  next() {
    if (this.busy) return;
    this.busy = true;
    const id = nextAnimal(this.animal.id);
    this.el.info.classList.remove("is-visible");
    this.el.stage.classList.add("is-leaving");
    this.onNavigate?.(id);
    const token = this.token;
    setTimeout(() => {
      if (token === this.token) this.start(id, this.level.id);
    }, reducedMotion ? 0 : 650);
  }

  // Wyjście do menu. W trakcie układania pyta, czy na pewno porzucić ułożone elementy.
  async requestExit() {
    if (this.phase === "puzzle" && this.puzzle?.placedCount > 0) {
      const leave = await this.confirm({
        title: "Przerwać układanie?",
        text: `Ułożone elementy (${this.puzzle.placedCount} z ${this.puzzle.pieces.length}) nie zostaną zapamiętane.`,
        confirm: "Wyjdź do menu",
        cancel: "Układam dalej",
      });
      if (!leave) return false;
    }
    this.stop();
    this.onExit();
    return true;
  }

  stop() {
    this.token++;
    this.busy = false;
    this.stopTimer();
    this.filmWait?.abort();
    const { video, playFallback, info, tray } = this.el;
    video.pause();
    playFallback.hidden = true;
    info.classList.remove("is-visible");
    tray.classList.remove("is-peeking");
    this.phase = "idle";
    const token = this.token;
    // Sprzątamy dopiero, gdy ekran gry zniknie, żeby nic nie mignęło.
    setTimeout(() => {
      if (token !== this.token) return;
      this.puzzle?.destroy();
      this.puzzle = null;
      this.resetStage();
      for (const flyer of this.root.querySelectorAll(".flyer")) flyer.remove();
      // Element wideo jest wspólny z trybem „W przestrzeni”, który mógł już załadować swój film.
      if (video.getAttribute("src") === this.animal.video) {
        video.removeAttribute("src");
        video.load();
      }
    }, 700);
  }

  // Cały obrazek na planszy przez chwilę, jak zdjęcie na pudełku z puzzlami.
  peek() {
    if (this.phase !== "puzzle") return;
    const tray = this.el.tray;
    clearTimeout(this.peekTimer);
    const show = !tray.classList.contains("is-peeking");
    tray.classList.toggle("is-peeking", show);
    if (show) this.peekTimer = setTimeout(() => tray.classList.remove("is-peeking"), PEEK_MS);
  }

  layout() {
    if (!this.puzzle) return;
    this.puzzle.layout({ top: this.el.topbar.offsetHeight });
    if (this.phase === "video" || this.phase === "info") this.placeStage(this.stageRect());
  }

  resetStage() {
    const { stage } = this.el;
    stage.className = "stage";
    stage.style.transition = "none";
    stage.style.transform = "none";
    for (const still of stage.querySelectorAll(".stage__freeze")) still.remove();
  }

  // Prostokąt 16:9 na cały ekran. Przycinamy najwyżej około 1/6 kadru;
  // na wąskim ekranie (telefon trzymany pionowo) pokazujemy cały kadr.
  stageRect() {
    const W = this.root.clientWidth;
    const H = this.root.clientHeight;
    const cover = Math.max(W / 16, H / 9);
    const contain = Math.min(W / 16, H / 9);
    const unit = cover / contain < 1.2 ? cover : contain;
    const w = 16 * unit;
    const h = 9 * unit;
    return { x: (W - w) / 2, y: H > W ? Math.max(0, (H - h) * 0.3) : (H - h) / 2, w, h };
  }

  placeStage({ x, y, w, h }) {
    Object.assign(this.el.stage.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
  }

  setHint(text) {
    this.el.hint.textContent = text;
    this.el.hint.classList.remove("is-hidden");
  }

  renderMeter(count) {
    const total = pieceCount(this.level);
    const meter = this.el.meter;
    if (meter.children.length !== total) meter.innerHTML = "<i></i>".repeat(total);
    [...meter.children].forEach((segment, i) => segment.classList.toggle("is-on", i < count));
    this.el.meterText.textContent = `${count}/${total}`;
  }

  // Czas układania liczy się tylko wtedy, gdy aplikacja jest na ekranie.
  startTimer() {
    this.timer = { running: true, elapsed: 0, since: document.hidden ? null : performance.now() };
  }

  stopTimer() {
    const timer = this.timer;
    if (timer.running && timer.since !== null) timer.elapsed += performance.now() - timer.since;
    timer.running = false;
    timer.since = null;
    return timer.elapsed / 1000;
  }

  onVisibility() {
    const timer = this.timer;
    if (timer.running) {
      if (document.hidden && timer.since !== null) {
        timer.elapsed += performance.now() - timer.since;
        timer.since = null;
      } else if (!document.hidden) {
        timer.since = performance.now();
      }
    }
    // Film zatrzymuje się razem ze schowaną kartą i rusza po powrocie.
    const video = this.el.video;
    if (document.hidden && this.phase === "video" && !video.paused) {
      this.resumeVideo = true;
      video.pause();
    } else if (!document.hidden && this.resumeVideo) {
      this.resumeVideo = false;
      if (this.phase === "video") video.play().catch(() => {});
    }
  }
}

// Kopia bieżącej klatki na wierzchu sceny, żeby film mógł pod nią niewidocznie wrócić na początek.
function freezeFrame(video) {
  const canvas = document.createElement("canvas");
  canvas.className = "stage__freeze";
  canvas.width = video.videoWidth || 16;
  canvas.height = video.videoHeight || 9;
  try {
    canvas.getContext("2d").drawImage(video, 0, 0);
  } catch {
    // klatka niedostępna: przenikanie zacznie się od pustego płótna
  }
  video.after(canvas);
  return canvas;
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
  try {
    await image.decode();
  } catch {
    // Starsze Safari potrafią odrzucić decode() dla poprawnego obrazka: czekamy wtedy na zwykłe load.
    if (!image.complete) {
      await new Promise((resolve, reject) => {
        image.addEventListener("load", resolve, { once: true });
        image.addEventListener("error", reject, { once: true });
      });
    }
    if (!image.naturalWidth) throw new Error(`Nie udało się wczytać obrazka ${src}`);
  }
  return image;
}
