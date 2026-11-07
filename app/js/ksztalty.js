// Kształty elementów puzzli: klasyczne wypustki i wcięcia z krzywych Béziera.
// Każda krawędź to łańcuch punktów krzywej sześciennej [p0, c1, c2, p1, c1, c2, p2, ...],
// więc odwrócona tablica to ta sama krawędź przebyta w drugą stronę.

const TAB = 0.1; // wielkość wypustki względem krótszego boku elementu
const JITTER = 0.035; // losowe odchylenia, żeby każda wypustka była trochę inna

export function createCuts(cols, rows, random = Math.random) {
  const vary = () => (random() * 2 - 1) * JITTER;
  const cut = () => ({ sign: random() < 0.5 ? -1 : 1, a: vary(), b: vary(), c: vary(), d: vary(), e: vary() });
  return {
    cols,
    rows,
    // horizontal[r][c]: krawędź między wierszem r i r + 1 w kolumnie c
    horizontal: Array.from({ length: rows - 1 }, () => Array.from({ length: cols }, cut)),
    // vertical[r][c]: krawędź między kolumną c i c + 1 w wierszu r
    vertical: Array.from({ length: rows }, () => Array.from({ length: cols - 1 }, cut)),
  };
}

// Obrys elementu (r, c) w układzie planszy, zgodnie z ruchem wskazówek zegara.
export function pieceOutline(cuts, r, c, width, height) {
  const size = Math.min(width, height);
  const x0 = c * width;
  const y0 = r * height;
  const x1 = x0 + width;
  const y1 = y0 + height;
  const edge = (from, to, cut) => (cut ? tabbed(from, to, cut, size) : straight(from, to));
  return [
    edge([x0, y0], [x1, y0], r > 0 && cuts.horizontal[r - 1][c]),
    edge([x1, y0], [x1, y1], c < cuts.cols - 1 && cuts.vertical[r][c]),
    edge([x0, y1], [x1, y1], r < cuts.rows - 1 && cuts.horizontal[r][c]).reverse(),
    edge([x0, y0], [x0, y1], c > 0 && cuts.vertical[r][c - 1]).reverse(),
  ];
}

export function toPath(edges, dx = 0, dy = 0) {
  const point = ([x, y]) => `${(x + dx).toFixed(2)} ${(y + dy).toFixed(2)}`;
  let path = `M${point(edges[0][0])}`;
  for (const chain of edges) {
    for (let i = 1; i < chain.length; i += 3) {
      path += `C${point(chain[i])} ${point(chain[i + 1])} ${point(chain[i + 2])}`;
    }
  }
  return `${path}Z`;
}

function straight([x0, y0], [x1, y1]) {
  const dx = (x1 - x0) / 3;
  const dy = (y1 - y0) / 3;
  return [[x0, y0], [x0 + dx, y0 + dy], [x0 + 2 * dx, y0 + 2 * dy], [x1, y1]];
}

// Krawędź z wypustką: szyjka zwęża się przy podstawie, główka jest okrągła.
function tabbed([x0, y0], [x1, y1], { sign, a, b, c, d, e }, size) {
  const length = Math.hypot(x1 - x0, y1 - y0);
  const ux = (x1 - x0) / length;
  const uy = (y1 - y0) / length;
  // Punkt odległy o `along` wzdłuż krawędzi i o `across` w bok, w stronę wypustki.
  const at = (along, across) => [x0 + ux * along - uy * across * sign, y0 + uy * along + ux * across * sign];
  const mid = length / 2 + b * size;
  const t = TAB * size;
  return [
    at(0, 0),
    at(0.2 * length, a * size),
    at(mid + d * size, -t + c * size),
    at(mid - t, t + c * size),
    at(mid - 2 * t - d * size, 3 * t + c * size),
    at(mid + 2 * t - d * size, 3 * t + c * size),
    at(mid + t, t + c * size),
    at(mid + e * size, -t + c * size),
    at(0.8 * length, e * size),
    at(length, 0),
  ];
}
