// Ikony rysowane na siatce 24×24, w jednym stylu: cienka linia z zaokrąglonymi końcami.

const LINE = 'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';
const svg = (body, attrs = LINE) => `<svg viewBox="0 0 24 24" ${attrs} aria-hidden="true">${body}</svg>`;

// Ikony faktów o zwierzętach
export const FACT_ICONS = {
  uszy: svg('<path d="M5 21c1.5-6 3.5-11.5 6.2-15 2.4 3.8 5.6 9.6 7.8 15"/><path d="M9 19c.8-3.5 1.8-6.4 2.6-8.4 1 2.4 2.3 5.4 3.2 8.4"/><path d="m11.2 6-.6-3.8M11.2 6l1.2-3.4"/>'),
  lapa: svg('<ellipse cx="12" cy="16" rx="4.4" ry="3.6"/><circle cx="5.9" cy="10.4" r="1.9"/><circle cx="9.5" cy="6.6" r="1.9"/><circle cx="14.5" cy="6.6" r="1.9"/><circle cx="18.1" cy="10.4" r="1.9"/>', 'fill="currentColor"'),
  teren: svg('<circle cx="12" cy="12" r="8.5" stroke-dasharray="2.6 2.6"/><circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none"/>'),
  ochrona: svg('<path d="M12 3 19 6v5.2c0 4.3-2.9 7.9-7 9.3-4.1-1.4-7-5-7-9.3V6z"/><path d="m8.8 12 2.2 2.2 4.4-4.6"/>'),
  ucho: svg('<path d="M7 9a5.5 5.5 0 1 1 11 0c0 3.2-2.2 4.4-3.4 5.8-.9 1-1.1 2.2-1.6 3.6A3 3 0 0 1 7.5 19"/><path d="M10 9.2a2.5 2.5 0 1 1 4.3 1.8c-.8.8-1.6 1.2-1.6 2.5"/>'),
  skok: svg('<path d="M3 19.5C4.5 11 11 6 17.5 11.5"/><path d="M16.4 8.4 17.5 11.5 14.3 10.9"/><circle cx="19.2" cy="17.6" r="1.6"/><path d="M2 21h20"/>'),
  ogon: svg('<path d="M3.5 19.5C9 20 12 17 13 12.5S16 5 20.5 4.5C21 9 19 13.5 15.5 16S8 19.8 3.5 19.5z"/><path d="M17.6 5.6c.4 1.4 1.4 2.4 2.7 2.8"/>'),
  nora: svg('<path d="M2.5 19.5h19"/><path d="M4.5 19.5c0-5 3.4-8.5 7.5-8.5s7.5 3.5 7.5 8.5"/><path d="M9 19.5a3 3 0 0 1 6 0"/><path d="M11 11l-.4-2M12.9 11l.4-2"/>'),
  poroze: svg('<path d="M9.6 12.5c0 3.8 1 6.6 2.4 8.3 1.4-1.7 2.4-4.5 2.4-8.3z"/><path d="M9.6 12.5 7.2 11.7M14.4 12.5l2.4-.8"/><path d="M10.2 11.4C8 10 6.6 7.5 6 4M6.6 7.2 3.8 6M7.8 9.6 5 9.9M6.2 5.4 7.5 3"/><path d="M13.8 11.4C16 10 17.4 7.5 18 4M17.4 7.2 20.2 6M16.2 9.6l2.8.3M17.8 5.4 16.5 3"/>'),
  dzwiek: svg('<path d="M4 9.5v5h3.5L12 18V6L7.5 9.5z"/><path d="M15.5 9a4 4 0 0 1 0 6"/><path d="M18.5 6.5a7.5 7.5 0 0 1 0 11"/>'),
  stado: svg('<circle cx="12" cy="8.5" r="3"/><path d="M6.5 20c.4-3.6 2.7-6 5.5-6s5.1 2.4 5.5 6"/><circle cx="5.5" cy="9.8" r="2.2"/><path d="M2 17.5c.3-2.3 1.7-3.8 3.5-3.8"/><circle cx="18.5" cy="9.8" r="2.2"/><path d="M22 17.5c-.3-2.3-1.7-3.8-3.5-3.8"/>'),
  waga: svg('<path d="M3.5 9.5v5M6.5 7v10M17.5 7v10M20.5 9.5v5M6.5 12h11"/>'),
  lustro: svg('<circle cx="12" cy="9" r="6"/><path d="M12 15v6M9.5 21h5"/><path d="M9.3 7.3A3.2 3.2 0 0 1 12 5.8"/>'),
  kalendarz: svg('<rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4M8 14h2M14 14h2M8 17h2"/>'),
  dlon: svg('<path d="M8.5 12.5V5.8a1.4 1.4 0 0 1 2.8 0V11M11.3 11V4.6a1.4 1.4 0 0 1 2.8 0V11M14.1 11V6.4a1.4 1.4 0 0 1 2.8 0v7.1c0 4.1-2.6 7-6.2 7-2.6 0-4.1-1.2-5.6-3.4l-2-3a1.5 1.5 0 0 1 2.4-1.8l1.6 2"/>'),
  pioro: svg('<path d="M20 4c-7.5.3-12.8 5.6-13.4 13.3 7.4-.4 12.6-5.4 13.4-13.3z"/><path d="M4 20 15 9"/>'),
  obrot: svg('<path d="M19.5 12A7.5 7.5 0 1 1 12 4.5"/><path d="M9.5 2 12 4.5 9.5 7"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/>'),
  orzech: svg('<path d="M5.5 10.5c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6z"/><path d="M12 4.5V2.8"/><path d="M7 10.5c0 4.6 2.2 8.3 5 10 2.8-1.7 5-5.4 5-10"/>'),
  kolor: svg('<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.3 0 1.8-.9 1.6-1.9-.3-1.4.6-2.6 2-2.6h1.9a3 3 0 0 0 3-3c0-5.3-3.8-9.5-8.5-9.5z"/><circle cx="7.6" cy="11.6" r="1.2"/><circle cx="9.7" cy="7.6" r="1.2"/><circle cx="14.4" cy="7.6" r="1.2"/>'),
  rodzina: svg('<circle cx="12" cy="4.5" r="2"/><circle cx="6.5" cy="12" r="2"/><circle cx="17.5" cy="12" r="2"/><circle cx="3.6" cy="19.6" r="1.6"/><circle cx="9.4" cy="19.6" r="1.6"/><circle cx="14.6" cy="19.6" r="1.6"/><circle cx="20.4" cy="19.6" r="1.6"/><path d="M10.8 6.2 7.7 10.3M13.2 6.2l3.1 4.1M5.7 13.8 4.3 18M7.3 13.8 8.7 18M16.7 13.8 15.3 18M18.3 13.8 19.7 18"/>'),
  las: svg('<path d="M8 3.5 3.5 11H6l-3 5h10l-3-5h2.5z"/><path d="M8 16v4"/><path d="M16.5 7l-3.2 5h1.8l-2.2 3.8h7.2L17.9 12h1.8z"/><path d="M16.5 15.8V20M2 20.5h20"/>'),
  swiatlo: svg('<path d="M10 4 3 18h14z"/><path d="M1.5 12.5 7 11"/><path d="m13.5 11.5 8-2.5M14 13l8 .5M14.2 14.5l7.6 3"/>'),
  stoper: svg('<circle cx="12" cy="13.5" r="7.5"/><path d="M10 3h4M12 3v3M12 13.5V9.5M18.4 7.1l1.2-1.2"/>'),
  pociag: svg('<path d="M2.5 7h8.5c5.6 0 9.5 3.4 11 8.5H2.5z"/><path d="M2.5 11h12.2"/><path d="M3 19h18M7 15.5V19M16 15.5V19"/>'),
  nos: svg('<ellipse cx="12" cy="12" rx="8" ry="6"/><ellipse cx="9.4" cy="12" rx="1.1" ry="2" fill="currentColor" stroke="none"/><ellipse cx="14.6" cy="12" rx="1.1" ry="2" fill="currentColor" stroke="none"/>'),
  kropla: svg('<path d="M12 3.5c3.2 4.2 6 7.6 6 11a6 6 0 0 1-12 0c0-3.4 2.8-6.8 6-11z"/><path d="M9.3 15.2a2.8 2.8 0 0 0 2.2 2.4"/>'),
  uwaga: svg('<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.2M12 17h.01"/>'),
};

// Ikony interfejsu
export const UI = {
  back: svg('<path d="M14.5 5.5 8 12l6.5 6.5"/>'),
  close: svg('<path d="m6.5 6.5 11 11M17.5 6.5l-11 11"/>'),
  info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6h.01"/>'),
  move: svg('<path d="M12 3v18M3 12h18M12 3 9 6M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>'),
  eye: svg('<path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>'),
  arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  replay: svg('<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4v4.5H9"/>'),
  puzzle: svg('<path d="M4.5 8h3.2a2.2 2.2 0 1 1 4.4 0h3.4v3.4a2.2 2.2 0 1 1 0 4.4v3.7h-11z"/>'),
  skip: svg('<path d="M6 5.5 15 12l-9 6.5z"/><path d="M18.5 5.5v13"/>'),
  clock: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  phone: svg('<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>'),
  star: svg('<path d="m12 3.8 2.5 5.2 5.7.8-4.1 4 1 5.7L12 16.8l-5.1 2.7 1-5.7-4.1-4 5.7-.8z"/>'),
  soundOn: svg('<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>'),
  soundOff: svg('<path d="M11 5 6 9H3v6h3l5 4z"/><path d="m16 9.5 5 5M21 9.5l-5 5"/>'),
};

// Listek: zdobyty (wypełniony) albo jeszcze nie (sam kontur). Trzy listki to trzy poziomy.
export function leaf(filled) {
  return `<svg class="leaf${filled ? " is-filled" : ""}" viewBox="0 0 24 24" aria-hidden="true"><path class="leaf__blade" d="M4.5 20C4 10.6 9.8 4.3 20 4c-.3 10.3-6.4 16.3-15.5 16z"/><path class="leaf__vein" d="M5 19.5 13.5 11"/></svg>`;
}

// Siatka elementów jako miniaturka poziomu: 3×2, 4×3, 6×4.
export function gridIcon(cols, rows) {
  const w = 22;
  const h = (w * 9) / 16;
  const lines = [];
  for (let c = 1; c < cols; c++) lines.push(`M${(1 + (w * c) / cols).toFixed(2)} ${1}v${h.toFixed(2)}`);
  for (let r = 1; r < rows; r++) lines.push(`M1 ${(1 + (h * r) / rows).toFixed(2)}h${w}`);
  return `<svg class="grid-icon" viewBox="0 0 24 ${(h + 2).toFixed(2)}" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><rect x="1" y="1" width="${w}" height="${h.toFixed(2)}" rx="1.5"/><path d="${lines.join("")}" stroke-width="0.9"/></svg>`;
}

// Znak aplikacji: element puzzli z sosną.
export const LOGO = `<svg class="logo" viewBox="0 0 64 64" aria-hidden="true">
  <defs><linearGradient id="logo-fill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4c27e"/><stop offset="1" stop-color="#d48f3c"/></linearGradient></defs>
  <path fill="url(#logo-fill)" d="M8 19H22A6.5 6.5 0 1 1 32 19H46V33A6.5 6.5 0 1 1 46 43V57H8Z"/>
  <path fill="#13201a" d="M27 24.5 34.5 35H31l6 8.5H17l6-8.5h-3.5z"/>
  <rect fill="#13201a" x="25.2" y="43.5" width="3.6" height="7" rx="0.8"/>
</svg>`;
