// Okna dialogowe: pytanie z dwiema odpowiedziami, wybór ekranu albo telefonu i okno „O aplikacji” z zakładkami.
// Natywny <dialog> sam pilnuje fokusu i zamyka się klawiszem Esc.
import { qrSvg } from "./qr.js";

const $ = (id) => document.getElementById(id);
let selectAboutTab = null;

// Zwraca true, gdy gracz wybrał przycisk potwierdzenia.
export function confirmDialog({ title, text, confirm, cancel }) {
  const dialog = $("confirmDialog");
  $("confirmTitle").textContent = title;
  $("confirmText").textContent = text;
  $("confirmOk").textContent = confirm;
  $("confirmCancel").textContent = cancel;
  dialog.returnValue = "";
  dialog.showModal();
  return new Promise((resolve) => {
    dialog.addEventListener("close", () => resolve(dialog.returnValue === "ok"), { once: true });
  });
}

// Wybór zwierzęcia na komputerze. Zwraca true, gdy gracz wybrał układanie na ekranie.
export function phoneDialog({ title, meta, thumb, focus, link }) {
  const dialog = $("phoneDialog");
  $("phoneTitle").textContent = title;
  $("phoneMeta").textContent = meta;
  $("phoneThumb").src = thumb;
  $("phoneThumb").style.objectPosition = focus;
  $("phoneQr").innerHTML = qrSvg(link);
  dialog.returnValue = "";
  dialog.showModal();
  return new Promise((resolve) => {
    dialog.addEventListener("close", () => resolve(dialog.returnValue === "ok"), { once: true });
  });
}

export function setupDialogs() {
  for (const dialog of document.querySelectorAll("dialog")) {
    // Kliknięcie w przyciemnione tło poza oknem zamyka je jak „Anuluj”. Drugie kliknięcie
    // z podwójnego kliknięcia karty, które samo otworzyło okno, nie liczy się.
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog && event.detail < 2) dialog.close("");
    });
    for (const button of dialog.querySelectorAll("[data-close]")) {
      button.addEventListener("click", () => dialog.close(""));
    }
  }
  selectAboutTab = setupTabs($("aboutDialog").querySelector('[role="tablist"]'));
}

// Okno zawsze otwiera się na pierwszej zakładce, przewinięte do góry.
export function openAbout() {
  const dialog = $("aboutDialog");
  selectAboutTab(dialog.querySelector('[role="tab"]'));
  dialog.querySelector(".dialog__panel").scrollTop = 0;
  dialog.showModal();
}

// Zakładki według wzorca WAI-ARIA: strzałki, Home i End przełączają, Tab przechodzi do treści.
function setupTabs(tablist) {
  const tabs = [...tablist.querySelectorAll('[role="tab"]')];
  const select = (tab, focus = false) => {
    for (const other of tabs) {
      const selected = other === tab;
      other.setAttribute("aria-selected", String(selected));
      other.tabIndex = selected ? 0 : -1;
      $(other.getAttribute("aria-controls")).hidden = !selected;
    }
    if (focus) tab.focus();
  };
  tablist.addEventListener("click", (event) => {
    const tab = event.target.closest('[role="tab"]');
    if (tab) select(tab);
  });
  tablist.addEventListener("keydown", (event) => {
    const index = tabs.indexOf(document.activeElement);
    const next = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 }[event.key];
    if (index < 0 || next === undefined) return;
    event.preventDefault();
    select(tabs[(next + tabs.length) % tabs.length], true);
  });
  return select;
}
