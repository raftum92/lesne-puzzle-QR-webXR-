// Kopia gry do wgrania na serwer, w której adresy kodu mają dopisaną wersję (?v=…).
//
// Cloudflare i przeglądarki trzymają skrypty i style do 4 godzin, a moduły wczytywane później (np. tryb W przestrzeni)
// nie odświeżają się nawet po wyczyszczeniu pamięci strony. Z wersją w adresie każda zmiana kodu daje nowe adresy,
// więc telefon od razu pobiera nowy kod. HTML gry Cloudflare podaje zawsze świeży, dlatego wersja jest w nim.
// Pliki w repozytorium zostają bez wersji: podgląd na localhost i GitHub Pages działają jak dotąd.
//
// Użycie: node narzedzia/wersjonuj.mjs <katalog>   wypisuje listę plików kodu, a wersję na stderr
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Kod: HTML, skrypty, style, Three.js i manifest. Filmy, obrazki i czcionki zmieniają się rzadko i nie mają wersji.
export function isCode(file) {
  return (
    file === "index.html" ||
    file === "app/index.html" ||
    file === "app/manifest.json" ||
    /^app\/js\/.+\.js$/.test(file) ||
    /^app\/css\/.+\.css$/.test(file) ||
    /^app\/vendor\/[^/]+$/.test(file)
  );
}

export function codeFiles(root) {
  const inApp = readdirSync(join(root, "app"), { recursive: true }).map((name) => `app/${String(name).split("\\").join("/")}`);
  return ["index.html", ...inApp].filter(isCode).sort();
}

// Skrót treści całego kodu: zmienia się dokładnie wtedy, gdy zmieni się którykolwiek plik kodu.
export function versionOf(root, files = codeFiles(root)) {
  const hash = createHash("sha256");
  for (const file of files) hash.update(file).update("\0").update(readFileSync(join(root, file))).update("\0");
  return hash.digest("hex").slice(0, 10);
}

// Względne importy modułów: `from "./a.js"`, `import "./a.js"` i `import("./a.js")`.
const IMPORT = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(["'])(\.{1,2}\/[^"'?]+\.js)\2/g;

export function rewriteJs(source, version) {
  return source.replace(IMPORT, (match, keyword, quote, specifier) => `${keyword}${quote}${specifier}?v=${version}${quote}`);
}

const isRelative = (url) => !/^([a-z][a-z0-9+.-]*:|\/)/i.test(url) && !url.includes("?");

function withVersion(tag, attribute, version) {
  return tag.replace(new RegExp(`(\\b${attribute}=)(["'])([^"']+)\\2`), (match, name, quote, url) =>
    isRelative(url) ? `${name}${quote}${url}?v=${version}${quote}` : match,
  );
}

// Style i skrypty w HTML. Ikona i manifest zostają bez wersji.
export function rewriteHtml(html, version) {
  return html
    .replace(/<link\b[^>]*>/g, (tag) => (/\brel=["']stylesheet["']/.test(tag) ? withVersion(tag, "href", version) : tag))
    .replace(/<script\b[^>]*>/g, (tag) => withVersion(tag, "src", version));
}

// Kopiuje kod do `out`, z wersją w importach skryptów gry i w app/index.html. Zwraca wersję i listę plików.
export function buildVersioned(root, out) {
  const files = codeFiles(root);
  const version = versionOf(root, files);
  for (const file of files) {
    let content = readFileSync(join(root, file));
    if (/^app\/js\/.+\.js$/.test(file)) content = rewriteJs(content.toString("utf8"), version);
    else if (file === "app/index.html") content = rewriteHtml(content.toString("utf8"), version);
    mkdirSync(dirname(join(out, file)), { recursive: true });
    writeFileSync(join(out, file), content);
  }
  return { version, files };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = process.argv[2];
  if (!out) {
    console.error("Użycie: node narzedzia/wersjonuj.mjs <katalog>");
    process.exit(1);
  }
  const root = fileURLToPath(new URL("..", import.meta.url));
  const { version, files } = buildVersioned(root, resolve(out));
  console.error(`wersja: ${version}`);
  console.log(files.join("\n"));
}
