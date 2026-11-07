// Plansza z elementami puzzli: rozmieszczenie na ekranie, przeciąganie i przyciąganie do miejsca.
import { createCuts, pieceOutline, toPath } from "./ksztalty.js";

const TILT = 9; // największy przechył elementów leżących obok planszy, w stopniach
const PICKUP_MS = 170; // czas, w którym podniesiony element rośnie do pełnej wielkości
const SWING = 0.5; // jak mocno element kołysze się przy szybkim przesuwaniu
const TRAY_SCALE = 0.75; // pożądana wielkość elementów obok planszy; mniejsze trudniej rozpoznać
const MIN_SNAP_PX = 14; // na małym ekranie przyciąganie nie może być węższe niż czubek palca

const easeOut = (k) => 1 - (1 - k) ** 3;
const easeInOut = (k) => (k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class Puzzle {
  constructor({ table, tray, ghost, slots, image, cols, rows, snap = 0.34, hints = true, onPick, onSnap, onComplete }) {
    Object.assign(this, { table, tray, ghost, slots, image, cols, rows, snap, hints, onPick, onSnap, onComplete });
    this.cuts = createCuts(cols, rows);
    this.phase = "assembled";
    this.drag = null;
    this.z = 10;
    ghost.src = image.src;
    this.pieces = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) this.pieces.push(this.createPiece(r, c));
    }
    this.shuffleHomes();
  }

  createPiece(r, c) {
    const el = document.createElement("div");
    el.className = "piece";
    el.innerHTML = '<div class="piece__body"><canvas class="piece__img"></canvas><div class="piece__hit"></div></div>';
    const piece = {
      r, c, el,
      body: el.firstElementChild,
      canvas: el.querySelector("canvas"),
      hit: el.querySelector(".piece__hit"),
      x: 0, y: 0, rot: 0, s: 1,
      placed: false,
      home: 0,
      jitter: null,
      anim: 0,
    };
    piece.hit.addEventListener("pointerdown", (event) => this.grab(event, piece));
    piece.hit.addEventListener("pointermove", (event) => this.move(event, piece));
    piece.hit.addEventListener("pointerup", (event) => this.release(event, piece));
    piece.hit.addEventListener("pointercancel", (event) => this.release(event, piece));
    this.table.append(el);
    return piece;
  }

  // Każdy element dostaje losowe miejsce obok planszy i trochę inny przechył.
  shuffleHomes() {
    const homes = shuffle(this.pieces.map((_, i) => i));
    this.pieces.forEach((piece, i) => {
      piece.home = homes[i];
      piece.jitter = { x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, rot: Math.random() * 2 - 1 };
    });
  }

  get placedCount() {
    return this.pieces.filter((piece) => piece.placed).length;
  }

  reset() {
    this.cuts = createCuts(this.cols, this.rows);
    this.phase = "assembled";
    this.drag = null;
    this.z = 10;
    for (const piece of this.pieces) {
      piece.anim++;
      piece.placed = false;
      piece.el.classList.remove("is-placed", "is-snapped", "is-lifted");
      piece.el.style.zIndex = "";
    }
    this.shuffleHomes();
  }

  destroy() {
    this.phase = "destroyed";
    this.drag = null;
    for (const piece of this.pieces) {
      piece.anim++;
      piece.el.remove();
    }
    this.pieces = [];
    this.slots.innerHTML = "";
  }

  layout({ top }) {
    this.top = top;
    const W = this.table.clientWidth;
    const H = this.table.clientHeight;
    const { gap, bx, by, bw, bh, cell, homes, scale, spread } = planLayout(W, H, top, this.cols, this.rows);
    this.geom = {
      W, H, gap, bx, by, bw, bh,
      ...cell,
      boxW: cell.cw + cell.pad * 2,
      boxH: cell.ch + cell.pad * 2,
      scale, homes, spread,
    };
    Object.assign(this.tray.style, { left: `${bx}px`, top: `${by}px`, width: `${bw}px`, height: `${bh}px` });
    this.drawSlots();
    for (const piece of this.pieces) {
      this.drawPiece(piece);
      if (this.drag?.piece === piece) continue;
      piece.anim++;
      Object.assign(piece, piece.placed || this.phase === "assembled" ? this.targetOf(piece) : this.homeOf(piece));
      this.render(piece);
    }
  }

  boardRect() {
    const { bx, by, bw, bh } = this.geom;
    return { x: bx, y: by, w: bw, h: bh };
  }

  homeOf(piece) {
    const { W, H, gap, homes, spread, boxW, boxH, pieceW, pieceH, scale } = this.geom;
    const home = homes[piece.home];
    // Przechylony element jest trochę większy; pilnujemy, żeby nie wystawał poza ekran.
    const halfW = (pieceW * scale * 1.08) / 2 + gap / 2;
    const halfH = (pieceH * scale * 1.08) / 2 + gap / 2;
    const x = clamp(home.x + piece.jitter.x * spread.x * 0.7, halfW, W - halfW);
    const y = clamp(home.y + piece.jitter.y * spread.y * 0.7, this.top + halfH, H - halfH);
    return { x: x - boxW / 2, y: y - boxH / 2, rot: piece.jitter.rot * TILT, s: scale };
  }

  targetOf(piece) {
    const { bx, by, cw, ch, pad } = this.geom;
    return { x: bx + piece.c * cw - pad, y: by + piece.r * ch - pad, rot: 0, s: 1 };
  }

  // Obrysy miejsc na planszy: podpowiedź, gdzie pasuje który element.
  drawSlots() {
    const { bw, bh, cw, ch } = this.geom;
    this.slots.setAttribute("viewBox", `0 0 ${bw} ${bh}`);
    this.slots.innerHTML = this.pieces
      .map((piece) => `<path d="${toPath(pieceOutline(this.cuts, piece.r, piece.c, cw, ch))}"/>`)
      .join("");
    this.pieces.forEach((piece, i) => {
      piece.slot = this.slots.children[i];
      piece.slot.classList.toggle("is-filled", piece.placed);
    });
  }

  drawPiece(piece) {
    const { bw, bh, cw, ch, size, pad, boxW, boxH } = this.geom;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const ox = piece.c * cw - pad;
    const oy = piece.r * ch - pad;
    const outline = toPath(pieceOutline(this.cuts, piece.r, piece.c, cw, ch), -ox, -oy);
    for (const el of [piece.body, piece.canvas, piece.hit]) {
      Object.assign(el.style, { width: `${boxW}px`, height: `${boxH}px` });
    }
    // Element łapie się tylko za obrazek, nie za przezroczyste rogi wokół wypustek.
    piece.hit.style.clipPath = `path("${outline}")`;
    const canvas = piece.canvas;
    canvas.width = Math.round(boxW * ratio);
    canvas.height = Math.round(boxH * ratio);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const shape = new Path2D(outline);
    ctx.save();
    ctx.clip(shape);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(this.image, -ox, -oy, bw, bh);
    // Faza na krawędzi jak w tekturowym elemencie: światło z lewej u góry, cień z prawej u dołu.
    const bevel = clamp(size * 0.007, 0.8, 2.4);
    ctx.lineJoin = "round";
    ctx.lineWidth = bevel * 2;
    ctx.translate(bevel, bevel);
    ctx.strokeStyle = "rgba(255, 247, 228, 0.45)";
    ctx.stroke(shape);
    ctx.translate(-bevel * 2, -bevel * 2);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
    ctx.stroke(shape);
    ctx.restore();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
    ctx.stroke(shape);
  }

  render(piece) {
    piece.el.style.transform = `translate3d(${piece.x}px, ${piece.y}px, 0)`;
    piece.body.style.transform = `rotate(${piece.rot}deg) scale(${piece.s})`;
  }

  // Ułożony obrazek rozsypuje się: elementy odlatują łukiem na swoje miejsca obok planszy.
  // Przy wielu elementach odstępy są krótsze, żeby całość trwała mniej więcej tyle samo.
  async scatter() {
    this.phase = "scattering";
    const order = shuffle([...this.pieces]);
    const stagger = this.stagger;
    await Promise.all(order.map((piece, i) => this.fly(piece, this.homeOf(piece), i * stagger)));
    if (this.phase === "scattering") this.phase = "playing";
  }

  get stagger() {
    return Math.min(70, 900 / this.pieces.length);
  }

  async fly(piece, to, delay) {
    await sleep(delay);
    if (this.phase !== "scattering") return;
    piece.el.classList.add("is-lifted");
    piece.el.style.zIndex = ++this.z;
    await this.animate(piece, to, { duration: 850, ease: easeInOut, arc: this.geom.size * 0.25 });
    piece.el.classList.remove("is-lifted");
  }

  animate(piece, to, { duration, ease = easeInOut, arc = 0 }) {
    const id = ++piece.anim;
    const from = { x: piece.x, y: piece.y, rot: piece.rot, s: piece.s };
    const start = performance.now();
    return new Promise((resolve) => {
      const step = (now) => {
        if (piece.anim !== id) return resolve(false);
        const k = clamp((now - start) / duration, 0, 1);
        const e = ease(k);
        piece.x = from.x + (to.x - from.x) * e;
        piece.y = from.y + (to.y - from.y) * e - Math.sin(Math.PI * k) * arc;
        piece.rot = from.rot + (to.rot - from.rot) * e;
        piece.s = from.s + (to.s - from.s) * e;
        this.render(piece);
        if (k < 1) requestAnimationFrame(step);
        else resolve(true);
      };
      requestAnimationFrame(step);
    });
  }

  grab(event, piece) {
    if (this.phase !== "playing" || piece.placed || this.drag) return;
    event.preventDefault();
    try {
      piece.hit.setPointerCapture(event.pointerId);
    } catch {
      // zdarzenia syntetyczne nie mają prawdziwego wskaźnika do przechwycenia
    }
    piece.anim++; // przerywa trwającą animację tego elementu
    const p = this.point(event);
    const { boxW, boxH } = this.geom;
    const dx = p.x - (piece.x + boxW / 2);
    const dy = p.y - (piece.y + boxH / 2);
    const angle = (-piece.rot * Math.PI) / 180;
    const now = performance.now();
    this.drag = {
      piece,
      pointerId: event.pointerId,
      p,
      lastTime: now,
      start: now,
      velocity: 0,
      swing: 0,
      from: { rot: piece.rot, s: piece.s },
      // Punkt chwytu względem środka elementu, bez obrotu i skali: zostaje pod palcem przez całe przeciąganie.
      grip: {
        x: (dx * Math.cos(angle) - dy * Math.sin(angle)) / piece.s,
        y: (dx * Math.sin(angle) + dy * Math.cos(angle)) / piece.s,
      },
    };
    piece.el.style.zIndex = ++this.z;
    piece.el.classList.add("is-lifted");
    this.onPick?.(piece);
    requestAnimationFrame((time) => this.follow(time));
  }

  follow(now) {
    const drag = this.drag;
    if (!drag) return;
    const { piece, grip, from, p } = drag;
    const k = easeOut(clamp((now - drag.start) / PICKUP_MS, 0, 1));
    // Element trzymany nad środkiem odchyla się w stronę ruchu, jak kartonik trzymany w palcach.
    const swingTarget = clamp((-drag.velocity * grip.y * SWING) / this.geom.size, -6, 6);
    drag.swing += (swingTarget - drag.swing) * 0.15;
    drag.velocity *= 0.86;
    piece.s = from.s + (1 - from.s) * k;
    piece.rot = from.rot * (1 - k) + drag.swing;
    const angle = (piece.rot * Math.PI) / 180;
    const { boxW, boxH } = this.geom;
    piece.x = p.x - (grip.x * Math.cos(angle) - grip.y * Math.sin(angle)) * piece.s - boxW / 2;
    piece.y = p.y - (grip.x * Math.sin(angle) + grip.y * Math.cos(angle)) * piece.s - boxH / 2;
    this.render(piece);
    this.markNear(piece);
    requestAnimationFrame((time) => this.follow(time));
  }

  move(event, piece) {
    const drag = this.drag;
    if (!drag || drag.piece !== piece || drag.pointerId !== event.pointerId) return;
    const p = this.point(event);
    const now = performance.now();
    const dt = Math.max(8, now - drag.lastTime);
    drag.velocity = drag.velocity * 0.6 + ((p.x - drag.p.x) / dt) * 16 * 0.4;
    drag.p = p;
    drag.lastTime = now;
  }

  release(event, piece) {
    const drag = this.drag;
    if (!drag || drag.piece !== piece || drag.pointerId !== event.pointerId) return;
    this.drag = null;
    piece.el.classList.remove("is-lifted");
    this.markNear(null);
    if (this.distanceToTarget(piece) < this.snapRadius) {
      this.place(piece);
      return;
    }
    // Element upuszczony na planszy zostaje w pełnej wielkości, obok planszy wraca do rozmiaru reszty.
    const { W, H, boxW, boxH, bx, by, bw, bh, pad, scale } = this.geom;
    const cx = piece.x + boxW / 2;
    const cy = piece.y + boxH / 2;
    const onBoard = cx > bx - pad && cx < bx + bw + pad && cy > by - pad && cy < by + bh + pad;
    this.animate(
      piece,
      {
        x: clamp(piece.x, -boxW * 0.25, W - boxW * 0.75),
        y: clamp(piece.y, this.top - boxH * 0.25, H - boxH * 0.75),
        rot: 0,
        s: onBoard ? 1 : scale,
      },
      { duration: 260, ease: easeOut },
    );
  }

  get snapRadius() {
    return Math.max(this.snap * this.geom.size, MIN_SNAP_PX);
  }

  distanceToTarget(piece) {
    const target = this.targetOf(piece);
    return Math.hypot(piece.x - target.x, piece.y - target.y);
  }

  async place(piece) {
    piece.placed = true;
    piece.el.style.zIndex = 2; // ułożone elementy leżą pod luźnymi
    piece.el.classList.add("is-placed");
    piece.slot.classList.add("is-filled");
    await this.animate(piece, this.targetOf(piece), { duration: 150, ease: easeOut });
    piece.el.classList.add("is-snapped");
    setTimeout(() => piece.el.classList.remove("is-snapped"), 900);
    const count = this.placedCount;
    this.onSnap?.(count);
    if (count === this.pieces.length && this.phase === "playing") {
      this.phase = "done";
      this.onComplete?.();
    }
  }

  // Podświetla miejsce na planszy, gdy przeciągany element jest blisko niego (poza trudnym poziomem).
  markNear(dragged) {
    for (const piece of this.pieces) {
      const near = this.hints && piece === dragged && this.distanceToTarget(piece) < this.snapRadius * 1.6;
      piece.slot.classList.toggle("is-near", near);
    }
  }

  point(event) {
    const rect = this.table.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
}

// Rozkład stołu: gdzie leży plansza i gdzie czekają elementy. Nie potrzebuje obrazka,
// więc ekran gry może poznać miejsce planszy, zanim zdjęcie się wczyta.
export function planLayout(W, H, top, cols, rows) {
  const gap = clamp(Math.min(W, H) * 0.03, 12, 32);
  const plan = W > H * 1.1 ? planSides(W, H, top, gap, cols, rows) : planBelow(W, H, top, gap, cols, rows);
  return { ...plan, gap, bh: plan.bw * (9 / 16) };
}

// Wymiary jednego elementu dla planszy o danej szerokości.
function measure(bw, cols, rows) {
  const cw = bw / cols;
  const ch = (bw * (9 / 16)) / rows;
  const size = Math.min(cw, ch);
  // Element z wypustkami po obu stronach zajmuje komórkę powiększoną o ok. 0,6 krótszego boku.
  return { cw, ch, size, pad: Math.ceil(size * 0.32), pieceW: cw + size * 0.6, pieceH: ch + size * 0.6 };
}

// Ekran poziomy: plansza na środku, elementy po jej lewej i prawej stronie.
// Szukamy największej planszy, przy której elementy obok niej nie robią się za małe.
function planSides(W, H, top, gap, cols, rows) {
  const n = cols * rows;
  const areaH = H - top - gap;
  const maxBw = Math.min(W * 0.62, (H - top - gap * 2) * (16 / 9));
  let best = null;
  for (let f = 1; f >= 0.55; f -= 0.025) {
    const bw = maxBw * f;
    const cell = measure(bw, cols, rows);
    const sideW = (W - bw) / 2 - gap * 1.5;
    const grid = bestGrid(Math.ceil(n / 2), sideW, areaH, cell);
    const quality = Math.min(f, grid.scale / TRAY_SCALE);
    if (!best || quality > best.quality + 1e-6) best = { bw, cell, sideW, grid, quality };
  }
  const { bw, cell, sideW, grid } = best;
  const bx = (W - bw) / 2;
  const cellW = sideW / grid.cols;
  const cellH = areaH / grid.rows;
  const homes = Array.from({ length: n }, (_, i) => {
    const j = Math.floor(i / 2);
    const left = i % 2 === 0 ? gap * 0.75 : bx + bw + gap * 0.75;
    return { x: left + cellW * ((j % grid.cols) + 0.5), y: top + cellH * (Math.floor(j / grid.cols) + 0.5) };
  });
  return {
    bw, bx, by: top + (H - top - bw * (9 / 16)) / 2, cell, homes,
    scale: grid.scale,
    spread: { x: Math.max(0, cellW - cell.pieceW * grid.scale) / 2, y: Math.max(0, cellH - cell.pieceH * grid.scale) / 2 },
  };
}

// Ekran pionowy (telefon, tablet): plansza u góry, elementy w siatce pod nią.
function planBelow(W, H, top, gap, cols, rows) {
  const n = cols * rows;
  const maxBw = W - gap * 2;
  const areaW = W - gap;
  let best = null;
  for (let f = 1; f >= 0.6; f -= 0.025) {
    const bw = maxBw * f;
    const cell = measure(bw, cols, rows);
    const areaTop = top + gap + bw * (9 / 16) + gap * 1.5;
    const grid = bestGrid(n, areaW, H - areaTop - gap, cell);
    const quality = Math.min(f, grid.scale / TRAY_SCALE);
    if (!best || quality > best.quality + 1e-6) best = { bw, cell, areaTop, grid, quality };
  }
  const { bw, cell, areaTop, grid } = best;
  const cellW = areaW / grid.cols;
  const cellH = (H - areaTop - gap) / grid.rows;
  const homes = Array.from({ length: n }, (_, i) => {
    const row = Math.floor(i / grid.cols);
    // Niepełny ostatni rząd stoi na środku, a nie przy lewej krawędzi.
    const inRow = Math.min(grid.cols, n - row * grid.cols);
    const offset = ((grid.cols - inRow) * cellW) / 2;
    return { x: gap / 2 + offset + cellW * ((i % grid.cols) + 0.5), y: areaTop + cellH * (row + 0.5) };
  });
  return {
    bw, bx: (W - bw) / 2, by: top + gap, cell, homes,
    scale: grid.scale,
    spread: { x: Math.max(0, cellW - cell.pieceW * grid.scale) / 2, y: Math.max(0, cellH - cell.pieceH * grid.scale) / 2 },
  };
}

// Najlepszy podział obszaru na kolumny i rzędy: elementy mają być jak największe, ale nie większe niż na planszy.
function bestGrid(count, areaW, areaH, { pieceW, pieceH }) {
  let best = { cols: 1, rows: count, scale: 0 };
  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols);
    const scale = Math.min(areaW / (cols * pieceW), areaH / (rows * pieceH), 1);
    if (scale > best.scale + 1e-6) best = { cols, rows, scale };
  }
  return best;
}

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}
