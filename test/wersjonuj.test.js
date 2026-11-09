// Wersjonowanie przy wgrywaniu: adresy kodu dostają ?v=<wersja>, żeby telefony nie trzymały starych skryptów.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildVersioned, codeFiles, isCode, rewriteHtml, rewriteJs, versionOf } from "../narzedzia/wersjonuj.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url)); // ścieżka ze spacją i „ł”, dlatego fileURLToPath
const temp = () => mkdtempSync(join(tmpdir(), "wersjonuj-"));

test("rewriteJs dopisuje wersję do względnych importów, także dynamicznych i bez nazw", () => {
  const source = [
    'import { A } from "./a.js";',
    "import B from '../b.js';",
    'export { C } from "./c/d.js";',
    'import "./efekt.js";',
    'const m = import("./ar/gra-ar.js");',
    'import * as THREE from "../../vendor/three.module.min.js";',
  ].join("\n");
  assert.equal(
    rewriteJs(source, "abc"),
    [
      'import { A } from "./a.js?v=abc";',
      "import B from '../b.js?v=abc';",
      'export { C } from "./c/d.js?v=abc";',
      'import "./efekt.js?v=abc";',
      'const m = import("./ar/gra-ar.js?v=abc");',
      'import * as THREE from "../../vendor/three.module.min.js?v=abc";',
    ].join("\n"),
  );
});

test("rewriteJs nie rusza adresów zewnętrznych, plików z mediami ani tekstu, który nie jest importem", () => {
  const source = [
    'import x from "https://example.com/x.js";',
    'const film = "./filmy/lis.mp4";',
    'const opis = "zobacz ./plik.js w dokumentacji";',
    'video.src = "../assets/filmy/lis.mp4";',
    'import y from "./y.js?v=old";',
  ].join("\n");
  assert.equal(rewriteJs(source, "abc"), source);
});

test("rewriteHtml dopisuje wersję do stylów i skryptu, a nie do ikony, manifestu ani adresów zewnętrznych", () => {
  const html = [
    '<link rel="icon" href="media/ikona.svg" type="image/svg+xml">',
    '<link rel="manifest" href="manifest.json">',
    '<link rel="stylesheet" href="css/podstawa.css">',
    '<link rel="stylesheet" href="https://fonts.example.com/x.css">',
    '<script type="module" src="js/main.js"></script>',
    '<a href="https://freesound.org/x">Głos</a>',
  ].join("\n");
  assert.equal(
    rewriteHtml(html, "abc"),
    [
      '<link rel="icon" href="media/ikona.svg" type="image/svg+xml">',
      '<link rel="manifest" href="manifest.json">',
      '<link rel="stylesheet" href="css/podstawa.css?v=abc">',
      '<link rel="stylesheet" href="https://fonts.example.com/x.css">',
      '<script type="module" src="js/main.js?v=abc"></script>',
      '<a href="https://freesound.org/x">Głos</a>',
    ].join("\n"),
  );
});

test("kodem są HTML, skrypty, style, Three.js i manifest, a nie filmy ani obrazki", () => {
  for (const file of ["index.html", "app/index.html", "app/js/ar/gra-ar.js", "app/css/ar.css", "app/vendor/three.module.min.js", "app/manifest.json"]) {
    assert.ok(isCode(file), file);
  }
  for (const file of ["app/media/lis-mini.jpg", "app/media/czcionki/inter-latin.woff2", "assets/filmy/lis.mp4", "README.md", "test/qr.test.js"]) {
    assert.ok(!isCode(file), file);
  }
});

test("wersja zmienia się razem z kodem i tylko z nim", () => {
  const root = temp();
  try {
    cpSync(join(ROOT, "app"), join(root, "app"), { recursive: true, filter: (path) => !/\/(media|vendor)\//.test(path) });
    writeFileSync(join(root, "index.html"), "<!doctype html>");
    const first = versionOf(root);
    assert.match(first, /^[0-9a-f]{10}$/);
    assert.equal(versionOf(root), first, "ten sam kod, ta sama wersja");
    writeFileSync(join(root, "README.md"), "inny opis");
    assert.equal(versionOf(root), first, "zmiana poza kodem nie zmienia wersji");
    const file = join(root, "app/js/ar/uklad.js");
    writeFileSync(file, readFileSync(file, "utf8").replace("duza: 0.8", "duza: 0.9"));
    assert.notEqual(versionOf(root), first, "zmiana w kodzie zmienia wersję");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("kopia gry do wgrania: każdy import i odnośnik do kodu ma tę samą wersję", () => {
  const out = temp();
  try {
    const { version, files } = buildVersioned(ROOT, out);
    assert.deepEqual(files, codeFiles(ROOT));
    assert.ok(files.includes("app/js/ar/gra-ar.js") && files.includes("app/index.html") && files.includes("index.html"));
    let imports = 0;
    for (const file of files.filter((name) => name.endsWith(".js"))) {
      const source = readFileSync(join(out, file), "utf8");
      for (const [, specifier] of source.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)["'](\.{1,2}\/[^"']+)["']/g)) {
        imports++;
        assert.ok(specifier.endsWith(`.js?v=${version}`), `${file}: ${specifier}`);
      }
    }
    assert.ok(imports >= 40, `przepisane importy: ${imports}`);
    const html = readFileSync(join(out, "app/index.html"), "utf8");
    assert.ok(html.includes(`src="js/main.js?v=${version}"`));
    assert.equal(html.match(/rel="stylesheet" href="css\/[a-z]+\.css\?v=/g)?.length, 7);
    assert.equal(readFileSync(join(out, "app/vendor/three.module.min.js"), "utf8"), readFileSync(join(ROOT, "app/vendor/three.module.min.js"), "utf8"));
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
