// Leśne puzzle: ekran tytułowy, menu z wyborem zwierzęcia i poziomu, gra.
import { ANIMALS, ORDER } from "./zwierzeta.js";
import { Sounds } from "./dzwieki.js";
import { Progress, resolveMode } from "./postep.js";
import { Backdrop } from "./tlo.js";
import { Menu } from "./menu.js";
import { Game } from "./gra.js";
import { confirmDialog, openAbout, setupDialogs } from "./dialogi.js";
import { LOGO, UI } from "./ikony.js";
import { detectAr } from "./ar/wykrywanie.js";

const $ = (id) => document.getElementById(id);
const app = $("app");
const video = $("video");
const progress = new Progress();
const sounds = new Sounds("media/las.wav");
const backdrop = new Backdrop($("backdrop"));
let ignorePop = false; // wyjście przyciskiem w aplikacji samo cofa historię przeglądarki
let arKind = null; // "xr", "symulacja" albo null, gdy urządzenie nie obsługuje AR
let arGame = null; // obietnica gry w trybie „W pokoju”; Three.js ładuje się tylko na urządzeniach z AR
let arCurrent = null;

for (const el of document.querySelectorAll("[data-icon]")) el.innerHTML = UI[el.dataset.icon];
for (const el of document.querySelectorAll("[data-logo]")) el.innerHTML = LOGO;
setupDialogs();

const menu = new Menu({ root: $("menuScreen"), progress, sounds, backdrop, onPlay: play });
const game = new Game({
  root: $("gameScreen"),
  sounds,
  progress,
  backdrop,
  confirm: confirmDialog,
  onExit: backToMenu,
  onNavigate: (id) => history.replaceState({ screen: "game" }, "", `#${id}`),
});

boot();

function boot() {
  // Po odświeżeniu strony zawsze zaczynamy od ekranu tytułowego.
  if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  applySound(progress.muted);
  buildMosaic();
  const first = ANIMALS[ORDER[0]];
  backdrop.set(first.thumb);
  // Film musi mieć źródło, żeby dało się go „odblokować” w geście użytkownika (patrz unlockVideo).
  video.preload = "none";
  video.src = first.video;

  const enter = $("enterButton");
  enter.addEventListener("click", start, { once: true });
  enter.disabled = false;
  for (const button of document.querySelectorAll(".sound-btn")) button.addEventListener("click", toggleSound);
  for (const button of document.querySelectorAll('[data-action="about"]')) {
    button.addEventListener("click", () => {
      sounds.tap();
      openAbout();
    });
  }
  $("resetProgress").addEventListener("click", resetProgress);
  addEventListener("popstate", onPopState);
  addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || document.querySelector("dialog[open]")) return;
    const current = activeGame();
    if (!current) return;
    event.preventDefault(); // inaczej to samo naciśnięcie od razu zamknęłoby otwierane pytanie o wyjście
    current.requestExit();
  });
  setupAr();
}

async function setupAr() {
  arKind = await detectAr({ location, navigator });
  if (!arKind) return;
  menu.enableModes();
  loadArGame().catch(() => {}); // błąd ładowania obsłuży dopiero dotknięcie zwierzęcia
}

function loadArGame() {
  arGame ??= import("./ar/gra-ar.js").then(({ ArGame }) => {
    arCurrent = new ArGame({
      root: $("arScreen"),
      sounds,
      progress,
      video,
      kind: arKind,
      onExit: backToMenu,
      onNavigate: (id) => history.replaceState({ screen: "game" }, "", `#${id}`),
      onStartError: offerScreenMode,
    });
    return arCurrent;
  });
  // Po nieudanym ładowaniu (np. słabe Wi-Fi) następne dotknięcie spróbuje jeszcze raz.
  arGame.catch(() => {
    arGame = null;
  });
  return arGame;
}

async function offerScreenMode() {
  const toScreen = await confirmDialog({
    title: "Nie udało się uruchomić trybu W pokoju",
    text: "Możesz zagrać na ekranie.",
    confirm: "Zagraj na ekranie",
    cancel: "Zamknij",
  });
  if (toScreen) menu.selectMode("ekran");
}

function activeGame() {
  if (app.dataset.screen === "game") return game;
  if (app.dataset.screen === "ar") return arCurrent;
  return null;
}

// Tło ekranu tytułowego: rzędy miniatur wszystkich zwierząt, które powoli przesuwają się w przeciwne strony.
// Każdy rząd ma miniatury dwa razy, więc przesunięcie o połowę długości zapętla się bez szwu.
function buildMosaic() {
  const mosaic = $("mosaic");
  mosaic.innerHTML = Array.from({ length: 5 }, (_, row) => {
    const ids = ORDER.map((_, i) => ORDER[(i + row * 4) % ORDER.length]);
    const tiles = [...ids, ...ids]
      .map((id) => `<img src="${ANIMALS[id].thumb}" alt="" style="object-position: ${ANIMALS[id].focus}" decoding="async">`)
      .join("");
    return `<div class="title__row">${tiles}</div>`;
  }).join("");
  const loaded = [...mosaic.querySelectorAll("img")].slice(0, ORDER.length).map((img) => img.decode().catch(() => {}));
  Promise.all(loaded).then(() => mosaic.classList.add("is-ready"));
}

// Pierwsze kliknięcie: od teraz wolno grać dźwięki i odtwarzać filmy z dźwiękiem.
function start() {
  sounds.unlock();
  unlockVideo();
  sounds.startAmbience(2.5);
  sounds.tap();
  showScreen("menu");
  menu.show();
  $("menuHeading").focus({ preventScroll: true });
}

function play(animalId, levelId, from) {
  if (app.dataset.screen === "game" || app.dataset.screen === "ar") return; // podwójne kliknięcie karty
  sounds.unlock();
  sounds.tap();
  history.pushState({ screen: "game" }, "", `#${animalId}`);
  if (resolveMode(progress.mode, arKind) === "pokoj") {
    showScreen("ar");
    loadArGame()
      .then((ar) => ar.start(animalId, levelId))
      .catch((error) => {
        console.warn("Nie udało się uruchomić trybu W pokoju:", error);
        backToMenu();
        offerScreenMode();
      });
    return;
  }
  showScreen("game");
  game.start(animalId, levelId, from);
}

function backToMenu() {
  showScreen("menu");
  menu.show();
  sounds.startAmbience(2);
  document.title = "Leśne puzzle";
  if (history.state?.screen === "game") {
    ignorePop = true;
    history.back();
  }
}

// Przycisk „wstecz” w przeglądarce albo na Androidzie działa jak strzałka w aplikacji.
async function onPopState() {
  if (ignorePop) {
    ignorePop = false;
    return;
  }
  const current = activeGame();
  if (!current) return;
  const left = await current.requestExit();
  if (!left) history.pushState({ screen: "game" }, "", `#${current.animal.id}`);
}

function showScreen(name) {
  app.dataset.screen = name;
  for (const screen of document.querySelectorAll(".screen")) screen.inert = screen.dataset.name !== name;
  if (name !== "game") document.title = "Leśne puzzle";
}

function toggleSound() {
  const muted = !progress.muted;
  progress.muted = muted;
  applySound(muted);
  if (!muted) sounds.tap();
}

function applySound(muted) {
  sounds.setMuted(muted);
  video.muted = muted;
  app.classList.toggle("is-muted", muted);
  for (const button of document.querySelectorAll(".sound-btn")) {
    button.setAttribute("aria-label", muted ? "Włącz dźwięk" : "Wycisz dźwięk");
    button.setAttribute("aria-pressed", String(muted));
  }
}

async function resetProgress() {
  const reset = await confirmDialog({
    title: "Wyzerować postęp?",
    text: "Znikną wszystkie zebrane listki i rekordy czasu zapisane na tym urządzeniu.",
    confirm: "Wyzeruj",
    cancel: "Anuluj",
  });
  if (!reset) return;
  progress.reset();
  menu.update();
}

// Safari na iPhonie i iPadzie odtworzy później film z dźwiękiem tylko wtedy, gdy pierwsze play()
// padło w geście użytkownika. Od razu pauzujemy, więc nic nie zdąży zagrać.
function unlockVideo() {
  const attempt = video.play();
  video.pause();
  attempt?.catch(() => {});
}
