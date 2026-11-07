// Ekran wyboru zwierzęcia i poziomu trudności.
import { ANIMALS, ORDER } from "./zwierzeta.js";
import { LEVELS, LEVEL_ORDER, pieceCount, piecesLabel } from "./poziomy.js";
import { UI, gridIcon, leaf } from "./ikony.js";
import { formatTime } from "./postep.js";

const MODE_ORDER = ["ekran", "pokoj"];
const MODE_NAMES = { ekran: "Na ekranie", pokoj: "W pokoju" };

export class Menu {
  constructor({ root, progress, sounds, backdrop, onPlay }) {
    Object.assign(this, { root, progress, sounds, backdrop, onPlay });
    this.levels = root.querySelector("#levels");
    this.cards = root.querySelector("#cards");
    this.stats = root.querySelector("#menuStats");
    this.modes = root.querySelector("#modes");
    this.renderLevels();
    this.renderCards();
    this.select(LEVELS[progress.level] ? progress.level : "latwy", { silent: true });
  }

  // Przełącznik trybu gry. Pojawia się tylko na urządzeniach, które obsługują AR.
  enableModes() {
    this.modes.innerHTML = MODE_ORDER.map(
      (id) => `<button class="modes__option" type="button" role="radio" data-mode="${id}">${MODE_NAMES[id]}</button>`,
    ).join("");
    this.modes.addEventListener("click", (event) => {
      const option = event.target.closest("[data-mode]");
      if (option) this.selectMode(option.dataset.mode);
    });
    this.modes.addEventListener("keydown", (event) => {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
      if (!step) return;
      event.preventDefault();
      const next = MODE_ORDER[(MODE_ORDER.indexOf(this.progress.mode) + step + MODE_ORDER.length) % MODE_ORDER.length];
      this.selectMode(next);
      this.modes.querySelector(`[data-mode="${next}"]`).focus();
    });
    this.modes.hidden = false;
    this.selectMode(this.progress.mode, { silent: true });
  }

  selectMode(id, { silent = false } = {}) {
    if (!silent && id !== this.progress.mode) this.sounds.tap();
    this.progress.mode = id;
    for (const option of this.modes.querySelectorAll("[data-mode]")) {
      const checked = option.dataset.mode === id;
      option.setAttribute("aria-checked", String(checked));
      option.tabIndex = checked ? 0 : -1;
    }
  }

  renderLevels() {
    this.levels.innerHTML =
      '<span class="levels__thumb" aria-hidden="true"></span>' +
      LEVEL_ORDER.map((id) => {
        const level = LEVELS[id];
        return `
          <button class="levels__option" type="button" role="radio" data-level="${id}">
            ${gridIcon(level.cols, level.rows)}
            <span class="levels__name">${level.name}</span>
            <span class="levels__count">${piecesLabel(pieceCount(level))}</span>
          </button>`;
      }).join("");
    this.levels.addEventListener("click", (event) => {
      const option = event.target.closest("[data-level]");
      if (option) this.select(option.dataset.level);
    });
    // Grupa przycisków radiowych: strzałki zmieniają poziom, Tab przechodzi dalej.
    this.levels.addEventListener("keydown", (event) => {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
      if (!step) return;
      event.preventDefault();
      const index = LEVEL_ORDER.indexOf(this.progress.level);
      const next = LEVEL_ORDER[(index + step + LEVEL_ORDER.length) % LEVEL_ORDER.length];
      this.select(next);
      this.levels.querySelector(`[data-level="${next}"]`).focus();
    });
  }

  select(id, { silent = false } = {}) {
    if (!silent && id !== this.progress.level) this.sounds.tap();
    this.progress.level = id;
    for (const option of this.levels.querySelectorAll("[data-level]")) {
      const checked = option.dataset.level === id;
      option.setAttribute("aria-checked", String(checked));
      option.tabIndex = checked ? 0 : -1;
    }
    this.levels.style.setProperty("--index", LEVEL_ORDER.indexOf(id));
    this.update();
  }

  renderCards() {
    this.cards.innerHTML = ORDER.map((id, i) => {
      const animal = ANIMALS[id];
      return `
        <li class="cards__item" style="--i: ${i}">
          <button class="card" type="button" data-animal="${id}">
            <img class="card__img" src="${animal.thumb}" alt="" style="object-position: ${animal.focus}" decoding="async">
            <span class="card__shade"></span>
            <span class="card__leaves"></span>
            <span class="card__body">
              <span class="card__name">${animal.name}</span>
              <span class="card__latin">${animal.latin}</span>
            </span>
            <span class="card__best"></span>
            <span class="sr-only card__status"></span>
          </button>
        </li>`;
    }).join("");
    this.cards.addEventListener("click", (event) => {
      const card = event.target.closest(".card");
      if (card) this.play(card);
    });
    // Tło za menu przechodzi w zwierzę, nad którym jest kursor albo fokus.
    const preview = (event) => {
      const card = event.target.closest?.(".card");
      if (card) this.backdrop.set(ANIMALS[card.dataset.animal].thumb);
    };
    this.cards.addEventListener("pointerover", preview);
    this.cards.addEventListener("focusin", preview);
  }

  // Listki zdobyte na każdym poziomie, rekord na wybranym poziomie i licznik wszystkich listków.
  update() {
    const level = this.progress.level;
    for (const card of this.cards.querySelectorAll(".card")) {
      const id = card.dataset.animal;
      const done = LEVEL_ORDER.filter((levelId) => this.progress.isDone(id, levelId));
      card.querySelector(".card__leaves").innerHTML = LEVEL_ORDER.map((levelId) => leaf(done.includes(levelId))).join("");
      const best = this.progress.best(id, level);
      card.querySelector(".card__best").innerHTML = best === null ? "" : `${UI.clock}${formatTime(best)}`;
      card.classList.toggle("is-done", best !== null);
      card.querySelector(".card__status").textContent = done.length
        ? `. Ułożone poziomy: ${done.map((levelId) => LEVELS[levelId].name.toLowerCase()).join(", ")}`
        : ". Jeszcze nieułożone";
    }
    const total = ORDER.length * LEVEL_ORDER.length;
    const count = this.progress.count(ORDER, LEVEL_ORDER);
    this.stats.innerHTML = `${leaf(count > 0)}<span>Zebrane listki: <strong>${count}</strong> z ${total}</span>`;
  }

  show() {
    this.update();
    this.root.classList.remove("is-entering");
    void this.root.offsetWidth; // od nowa uruchamia animację wejścia kart
    this.root.classList.add("is-entering");
  }

  play(card) {
    const image = card.querySelector(".card__img").getBoundingClientRect();
    const radius = parseFloat(getComputedStyle(card).borderTopLeftRadius) || 0;
    this.onPlay(card.dataset.animal, this.progress.level, {
      rect: { x: image.left, y: image.top, w: image.width, h: image.height },
      radius,
    });
  }
}
