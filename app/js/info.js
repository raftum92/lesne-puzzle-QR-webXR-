// Ekran z informacją o zwierzęciu, pokazywany na zatrzymanej ostatniej klatce filmu.
import { POLAND, RIVERS, VIEWBOX, project, smoothPath } from "./mapa.js";
import { FACT_ICONS, UI, leaf } from "./ikony.js";
import { formatTime } from "./postep.js";

export function renderInfo(container, animal, { result, next, onNext, onReplay, onAgain }) {
  const delay = (seconds) => `style="--d: ${seconds}s"`;
  container.innerHTML = `
    <div class="info__scrim"></div>
    <div class="info__layout">
      <div class="info__panel">
        ${result ? resultLine(result, delay(0.05)) : ""}
        <p class="info__overline reveal" ${delay(0.1)}>${animal.species} · <i>${animal.latin}</i></p>
        <h2 class="info__title reveal" ${delay(0.2)} tabindex="-1">${animal.name}</h2>
        <p class="info__lead reveal" ${delay(0.35)}>${animal.lead}</p>
        <ul class="facts">
          ${animal.facts
            .map(
              (fact, i) => `
            <li class="fact reveal" ${delay(0.55 + i * 0.12)}>
              <span class="fact__icon">${FACT_ICONS[fact.icon]}</span>
              <div>
                <p class="fact__title">${fact.title}</p>
                <p class="fact__text">${fact.text}</p>
              </div>
            </li>`,
            )
            .join("")}
        </ul>
        <div class="actions reveal" ${delay(1.15)}>
          <button class="btn btn--primary" data-action="next" aria-label="Następne zwierzę: ${next.name}">
            Następne zwierzę ${UI.arrow}
          </button>
          <button class="btn btn--ghost" data-action="replay">${UI.replay} Obejrzyj jeszcze raz</button>
          <button class="btn btn--ghost" data-action="again">${UI.puzzle} Ułóż jeszcze raz</button>
        </div>
      </div>
      <aside class="map-card reveal" ${delay(0.8)}>
        <h3 class="map-card__title">Gdzie żyje w Polsce</h3>
        ${mapSvg(animal)}
        <ul class="legend">
          ${animal.range.legend.map(({ swatch, text }) => `<li><span class="legend__swatch legend__swatch--${swatch}"></span>${text}</li>`).join("")}
        </ul>
      </aside>
      <p class="credits reveal" ${delay(1.3)}>${animal.credits}</p>
    </div>`;
  container.querySelector('[data-action="next"]').addEventListener("click", onNext);
  container.querySelector('[data-action="replay"]').addEventListener("click", onReplay);
  container.querySelector('[data-action="again"]').addEventListener("click", onAgain);
}

// „Ułożone w 1:42 · poziom średni” z listkiem i wyróżnieniem pierwszego ułożenia albo rekordu.
function resultLine({ seconds, first, record, level }, style) {
  const badge = first
    ? '<span class="result__badge">Nowy listek</span>'
    : record
      ? `<span class="result__badge">${UI.star} Rekord</span>`
      : "";
  return `<p class="result reveal" ${style}>${leaf(true)}<span>Ułożone w ${formatTime(seconds)} · poziom ${level.name.toLowerCase()}</span>${badge}</p>`;
}

function mapSvg(animal) {
  const { glow = [], sites = [], labels = [], country = false, rivers = false } = animal.range;
  const circles = (points, r, className = "") =>
    points
      .map((point) => {
        const [x, y] = project(point);
        return `<circle class="${className}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}"/>`;
      })
      .join("");
  const texts = labels
    .map(({ text, at, anchor }) => {
      const [x, y] = project(at);
      return `<text class="map__label" x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}">${text}</text>`;
    })
    .join("");
  const riverPaths = Object.values(RIVERS)
    .map((points) => `<path d="${smoothPath(points)}"/>`)
    .join("");
  return `
    <svg class="map" viewBox="${VIEWBOX}" role="img" aria-label="Mapa Polski: gdzie żyje ${animal.name.toLowerCase()}">
      <defs>
        <clipPath id="map-clip"><path d="${POLAND}"/></clipPath>
        <filter id="map-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7"/></filter>
        <filter id="map-soft" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="2.2"/></filter>
        <radialGradient id="map-country" cx="50%" cy="48%" r="60%">
          <stop offset="0" stop-color="#e3a75b" stop-opacity="0.62"/>
          <stop offset="1" stop-color="#e3a75b" stop-opacity="0.3"/>
        </radialGradient>
      </defs>
      <path class="map__land" d="${POLAND}"/>
      ${country ? `<path class="map__country" d="${POLAND}" fill="url(#map-country)"/>` : ""}
      <g clip-path="url(#map-clip)">
        <g class="map__rivers${rivers ? " is-highlighted" : ""}">
          ${rivers ? `<g class="map__rivers-glow" filter="url(#map-soft)">${riverPaths}</g>` : ""}
          ${riverPaths}
        </g>
        <g class="map__range" filter="url(#map-blur)">${circles(glow, 20)}</g>
      </g>
      <path class="map__outline" d="${POLAND}"/>
      <g class="map__return">${circles(sites, 7, "ring")}${circles(sites, 2.2, "dot")}</g>
      ${texts}
    </svg>`;
}
