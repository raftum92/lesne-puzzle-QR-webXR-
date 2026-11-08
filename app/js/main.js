// Leśne puzzle: ekran tytułowy, menu z wyborem zwierzęcia i poziomu, gra.
import { ANIMALS, ORDER } from "./zwierzeta.js";
import { Sounds } from "./dzwieki.js";
import { Progress, resolveMode } from "./postep.js";
import { Backdrop } from "./tlo.js";
import { Menu } from "./menu.js";
import { Game } from "./gra.js";
import { confirmDialog, openAbout, phoneDialog, setupDialogs } from "./dialogi.js";
import { LOGO, UI } from "./ikony.js";
import { LEVELS, pieceCount, piecesLabel } from "./poziomy.js";
import { isHandheld, phoneLink, readPhoneLink } from "./telefon.js";
import { detectAr } from "./ar/wykrywanie.js";

const $ = (id) => document.getElementById(id);
const app = $("app");
const video = $("video");
const progress = new Progress();
// Telefon po zeskanowaniu kodu QR: tylko to jedno zwierzę, bez menu. Kolejne zwierzę wybiera się przy monitorze.
const visit = readPhoneLink(location.search);
const handheld = isHandheld(navigator);
const sounds = new Sounds("media/las.wav");
const backdrop = new Backdrop($("backdrop"));
let ignorePop = false; // wyjście przyciskiem w aplikacji samo cofa historię przeglądarki
let arKind = null; // "xr", "kamera", "symulacja" albo null, gdy urządzenie gra tylko na ekranie
let arGame = null; // obietnica gry w trybie „W przestrzeni”; Three.js ładuje się tylko na urządzeniach z AR
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
  oneAnimal: Boolean(visit),
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
  const arReady = setupAr();
  if (visit) {
    setupPhoneLanding(arReady);
  } else {
    const enter = $("enterButton");
    enter.addEventListener("click", start, { once: true });
    enter.disabled = false;
  }
}

async function setupAr() {
  arKind = await detectAr({ location, navigator, handheld });
  if (!arKind) return;
  menu.enableModes(arKind);
  if (arKind === "kamera") return; // kamera nie wymaga świeżego dotknięcia, więc Three.js załaduje się dopiero do gry
  await loadArGame().catch(() => {}); // błąd ładowania obsłuży dopiero dotknięcie zwierzęcia
}

// Ekran tytułowy telefonu z kodu QR: to zwierzę, ten poziom i jeden przycisk. Sesję AR wolno otworzyć dopiero
// po dotknięciu, a przycisk włącza się po wczytaniu Three.js, bo przeglądarka odrzuca sesję, gdy od dotknięcia
// minęło za dużo czasu. Na ten ekran gra wraca też z układanki, bo telefon nie ma menu.
async function setupPhoneLanding(arReady) {
  const animal = ANIMALS[visit.animal];
  const enter = $("enterButton");
  backdrop.set(animal.thumb);
  $("titleHeading").textContent = animal.name;
  $("titleHeading").classList.add("title__heading--animal");
  enter.textContent = "Chwileczkę…";
  await arReady;
  showLanding();
  enter.addEventListener("click", startFromLink);
  enter.disabled = false;
}

// Napisy zależą od trybu, który po nieudanym starcie AR mógł się zmienić na kamerę.
function showLanding() {
  const animal = ANIMALS[visit.animal];
  const level = LEVELS[visit.level];
  document.title = `${animal.name} · Leśne puzzle`;
  $("enterButton").textContent = !arKind ? "Ułóż na ekranie" : arKind === "kamera" ? "Ułóż z kamerą" : "Ułóż w przestrzeni";
  $("titleText").textContent =
    arKind === "kamera"
      ? "Ten telefon nie ma pełnego trybu W przestrzeni, więc obrazek ułożysz na tle obrazu z kamery."
      : !arKind
        ? "To urządzenie nie obsługuje trybu W przestrzeni, ale obrazek ułożysz na ekranie."
        : `Poziom ${level.name.toLowerCase()} · ${piecesLabel(pieceCount(level))}`;
}

function startFromLink() {
  if (app.dataset.screen !== "title") return;
  sounds.unlock();
  unlockVideo();
  sounds.startAmbience(2.5);
  sounds.tap();
  if (arKind) menu.selectMode("pokoj", { silent: true });
  launch(visit.animal, visit.level, null);
}

function loadArGame() {
  arGame ??= import("./ar/gra-ar.js").then(({ ArGame }) => {
    arCurrent = new ArGame({
      root: $("arScreen"),
      sounds,
      progress,
      video,
      kind: arKind,
      cameraFallback: Boolean(navigator.mediaDevices?.getUserMedia),
      oneAnimal: Boolean(visit),
      onKindChange: (kind) => {
        arKind = kind;
        menu.nameModes(kind);
      },
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

// Kod błędu na końcu tekstu pozwala ustalić, co poszło nie tak na telefonie, którego nie da się podłączyć do komputera.
async function offerScreenMode(failures = []) {
  const camera = arKind === "kamera";
  const code = failures.length ? ` Kod błędu: ${failures.join(", ")}.` : "";
  const toScreen = await confirmDialog({
    title: camera ? "Nie udało się włączyć kamery" : "Nie udało się uruchomić trybu W przestrzeni",
    text: (camera ? "Zezwól przeglądarce na użycie kamery albo zagraj na ekranie." : "Możesz zagrać na ekranie.") + code,
    confirm: "Zagraj na ekranie",
    cancel: "Zamknij",
  });
  if (!toScreen) return;
  menu.selectMode("ekran");
  if (visit) launch(visit.animal, visit.level, null); // telefon z kodu QR nie ma menu, z którego dałoby się zacząć
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

async function play(animalId, levelId, from) {
  if (app.dataset.screen === "game" || app.dataset.screen === "ar") return; // podwójne kliknięcie karty
  sounds.unlock();
  sounds.tap();
  // Na monitorze gracz wybiera: układanie na ekranie albo, dodatkowo, kod QR, który przenosi grę na telefon.
  if (!arKind && !handheld) {
    const animal = ANIMALS[animalId];
    const level = LEVELS[levelId];
    const onScreen = await phoneDialog({
      title: animal.name,
      meta: `Poziom ${level.name.toLowerCase()} · ${piecesLabel(pieceCount(level))}`,
      thumb: animal.thumb,
      focus: animal.focus,
      link: phoneLink(animalId, levelId, location),
    });
    if (!onScreen) return;
  }
  launch(animalId, levelId, from);
}

function launch(animalId, levelId, from) {
  history.pushState({ screen: "game" }, "", `#${animalId}`);
  if (resolveMode(progress.mode, arKind) === "pokoj") {
    showScreen("ar");
    loadArGame()
      .then((ar) => ar.start(animalId, levelId))
      .catch((error) => {
        console.warn("Nie udało się uruchomić trybu W przestrzeni:", error);
        backToMenu();
        offerScreenMode();
      });
    return;
  }
  showScreen("game");
  game.start(animalId, levelId, from);
}

function backToMenu() {
  if (visit) {
    showScreen("title");
    showLanding();
    $("enterButton").focus({ preventScroll: true });
  } else {
    showScreen("menu");
    menu.show();
    document.title = "Leśne puzzle";
  }
  sounds.startAmbience(2);
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
