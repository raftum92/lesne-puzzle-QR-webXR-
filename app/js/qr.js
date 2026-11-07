// Kod QR bez bibliotek, według normy ISO/IEC 18004: tryb bajtowy, korekcja błędów M, wersje 1–9.
// Mieści do 180 bajtów, a adres gry ma około 90. Zgodność z inną implementacją sprawdza test/qr.test.js.

const ECC_PER_BLOCK = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22];
const BLOCKS = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5];
const MAX_VERSION = 9;
const FORMAT_LEVEL_M = 0;
const QUIET_ZONE = 4; // wymagany jasny margines wokół kodu, w modułach

// Kod jako SVG. Moduły mają całą liczbę pikseli, a bok ma co najmniej `minPixels`, bo tak skanuje się najpewniej.
export function qrSvg(text, minPixels = 220) {
  const modules = qrMatrix(text);
  const side = modules.length + QUIET_ZONE * 2;
  const pixels = side * Math.ceil(minPixels / side);
  let path = "";
  modules.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) path += `M${x + QUIET_ZONE} ${y + QUIET_ZONE}h1v1h-1z`;
    });
  });
  return `<svg class="qr" width="${pixels}" height="${pixels}" viewBox="0 0 ${side} ${side}" shape-rendering="crispEdges" role="img" aria-label="Kod QR z adresem gry"><rect width="${side}" height="${side}" fill="#fff"/><path fill="#000" d="${path}"/></svg>`;
}

// Macierz modułów (true = ciemny), bez marginesu. `forcedMask` wybiera maskę 0–7 zamiast tej z najmniejszą karą.
export function qrMatrix(text, forcedMask = null) {
  const bytes = new TextEncoder().encode(text);
  const version = pickVersion(bytes.length);
  const size = version * 4 + 17;
  const modules = grid(size);
  const reserved = grid(size);
  const set = (x, y, dark) => {
    modules[y][x] = dark;
    reserved[y][x] = true;
  };
  drawFunctionPatterns(set, version, size);
  placeData(modules, reserved, withErrorCorrection(dataCodewords(bytes, version), version));

  const masks = forcedMask === null ? [0, 1, 2, 3, 4, 5, 6, 7] : [forcedMask];
  let best = null;
  let bestScore = Infinity;
  for (const mask of masks) {
    const candidate = applyMask(modules, reserved, mask);
    drawFormatBits((x, y, dark) => (candidate[y][x] = dark), mask, size);
    const score = penalty(candidate);
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

const grid = (size) => Array.from({ length: size }, () => new Array(size).fill(false));
const bit = (value, index) => ((value >>> index) & 1) === 1;

function rawCodewords(version) {
  let modules = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const align = Math.floor(version / 7) + 2;
    modules -= (25 * align - 10) * align - 55;
    if (version >= 7) modules -= 36;
  }
  return modules >>> 3;
}

const dataCapacity = (version) => rawCodewords(version) - ECC_PER_BLOCK[version] * BLOCKS[version];

function pickVersion(length) {
  for (let version = 1; version <= MAX_VERSION; version++) {
    if (length + 2 <= dataCapacity(version)) return version; // 2 bajty na tryb, długość i zakończenie
  }
  throw new RangeError(`Tekst jest za długi na kod QR: ${length} bajtów`);
}

function dataCodewords(bytes, version) {
  const capacity = dataCapacity(version) * 8;
  const bits = [];
  const push = (value, count) => {
    for (let i = count - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  push(0b0100, 4); // tryb bajtowy
  push(bytes.length, 8);
  for (const byte of bytes) push(byte, 8);
  push(0, Math.min(4, capacity - bits.length));
  push(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) push(pad, 8);

  const words = [];
  for (let i = 0; i < bits.length; i += 8) words.push(bits.slice(i, i + 8).reduce((word, b) => (word << 1) | b, 0));
  return words;
}

// Mnożenie w ciele GF(256), wielomian z normy QR.
function gfMultiply(a, b) {
  let result = 0;
  for (let i = 7; i >= 0; i--) {
    result = (result << 1) ^ ((result >>> 7) * 0x11d);
    result ^= ((b >>> i) & 1) * a;
  }
  return result;
}

function reedSolomonDivisor(degree) {
  const divisor = new Array(degree).fill(0);
  divisor[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      divisor[j] = gfMultiply(divisor[j], root);
      if (j + 1 < degree) divisor[j] ^= divisor[j + 1];
    }
    root = gfMultiply(root, 2);
  }
  return divisor;
}

function reedSolomonRemainder(data, divisor) {
  const remainder = divisor.map(() => 0);
  for (const byte of data) {
    const factor = byte ^ remainder.shift();
    remainder.push(0);
    divisor.forEach((coefficient, i) => {
      remainder[i] ^= gfMultiply(coefficient, factor);
    });
  }
  return remainder;
}

// Dzieli dane na bloki, dodaje do każdego korekcję błędów i przeplata bloki bajt po bajcie.
function withErrorCorrection(data, version) {
  const count = BLOCKS[version];
  const eccLength = ECC_PER_BLOCK[version];
  const raw = rawCodewords(version);
  const shortBlocks = count - (raw % count);
  const shortData = Math.floor(raw / count) - eccLength;
  const divisor = reedSolomonDivisor(eccLength);
  const dataBlocks = [];
  const eccBlocks = [];
  for (let i = 0, start = 0; i < count; i++) {
    const block = data.slice(start, start + shortData + (i < shortBlocks ? 0 : 1));
    start += block.length;
    dataBlocks.push(block);
    eccBlocks.push(reedSolomonRemainder(block, divisor));
  }
  const result = [];
  for (let i = 0; i <= shortData; i++) {
    for (const block of dataBlocks) if (i < block.length) result.push(block[i]);
  }
  for (let i = 0; i < eccLength; i++) {
    for (const block of eccBlocks) result.push(block[i]);
  }
  return result;
}

function drawFunctionPatterns(set, version, size) {
  for (let i = 0; i < size; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  drawFinder(set, 3, 3, size);
  drawFinder(set, size - 4, 3, size);
  drawFinder(set, 3, size - 4, size);

  const centers = alignmentCenters(version, size);
  const last = centers.length - 1;
  centers.forEach((cx, i) => {
    centers.forEach((cy, j) => {
      const onFinder = (i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0);
      if (!onFinder) drawAlignment(set, cx, cy);
    });
  });

  drawFormatBits(set, 0, size); // rezerwuje miejsce; właściwe bity trafiają tam po wyborze maski
  if (version >= 7) drawVersionBits(set, version, size);
}

function drawFinder(set, cx, cy, size) {
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      const ring = Math.max(Math.abs(dx), Math.abs(dy));
      if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, ring !== 2 && ring !== 4);
    }
  }
}

function drawAlignment(set, cx, cy) {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
}

function alignmentCenters(version, size) {
  if (version === 1) return [];
  const count = Math.floor(version / 7) + 2;
  const step = Math.floor((version * 8 + count * 3 + 5) / (count * 4 - 4)) * 2;
  const centers = [6];
  for (let center = size - 7; centers.length < count; center -= step) centers.splice(1, 0, center);
  return centers;
}

function drawFormatBits(set, mask, size) {
  const data = (FORMAT_LEVEL_M << 3) | mask;
  let remainder = data;
  for (let i = 0; i < 10; i++) remainder = (remainder << 1) ^ ((remainder >>> 9) * 0x537);
  const bits = ((data << 10) | remainder) ^ 0x5412;

  for (let i = 0; i <= 5; i++) set(8, i, bit(bits, i));
  set(8, 7, bit(bits, 6));
  set(8, 8, bit(bits, 7));
  set(7, 8, bit(bits, 8));
  for (let i = 9; i < 15; i++) set(14 - i, 8, bit(bits, i));

  for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(bits, i));
  for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(bits, i));
  set(8, size - 8, true);
}

function drawVersionBits(set, version, size) {
  let remainder = version;
  for (let i = 0; i < 12; i++) remainder = (remainder << 1) ^ ((remainder >>> 11) * 0x1f25);
  const bits = (version << 12) | remainder;
  for (let i = 0; i < 18; i++) {
    const a = size - 11 + (i % 3);
    const b = Math.floor(i / 3);
    set(a, b, bit(bits, i));
    set(b, a, bit(bits, i));
  }
}

// Bity danych idą zygzakiem od prawego dolnego rogu, parami kolumn, z pominięciem kolumny 6.
function placeData(modules, reserved, codewords) {
  const size = modules.length;
  let index = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    const upward = ((right + 1) & 2) === 0;
    for (let step = 0; step < size; step++) {
      const y = upward ? size - 1 - step : step;
      for (const x of [right, right - 1]) {
        if (reserved[y][x] || index >= codewords.length * 8) continue;
        modules[y][x] = bit(codewords[index >>> 3], 7 - (index & 7));
        index++;
      }
    }
  }
}

const MASKS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

function applyMask(modules, reserved, mask) {
  return modules.map((row, y) => row.map((dark, x) => (!reserved[y][x] && MASKS[mask](x, y) ? !dark : dark)));
}

// Kara z normy: im mniejsza, tym łatwiej zeskanować kod.
function penalty(modules) {
  const size = modules.length;
  const columns = modules[0].map((_, x) => modules.map((row) => row[x]));
  let score = 0;
  for (const line of [...modules, ...columns]) {
    const text = line.map(Number).join("");
    for (const run of text.match(/0{5,}|1{5,}/g) ?? []) score += run.length - 2;
    score += 40 * (text.match(/(?=10111010000|00001011101)/g) ?? []).length;
  }
  let dark = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (modules[y][x]) dark++;
      if (x + 1 === size || y + 1 === size) continue;
      const color = modules[y][x];
      if (modules[y][x + 1] === color && modules[y + 1][x] === color && modules[y + 1][x + 1] === color) score += 3;
    }
  }
  return score + 10 * Math.floor(Math.abs((dark * 100) / (size * size) - 50) / 5);
}
