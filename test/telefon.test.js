import { test } from "node:test";
import assert from "node:assert/strict";
import { PUBLIC_URL, phoneLink, readPhoneLink, withoutPhoneLink } from "../app/js/telefon.js";
import { ORDER } from "../app/js/zwierzeta.js";
import { LEVEL_ORDER } from "../app/js/poziomy.js";

const https = { protocol: "https:", origin: "https://example.com", pathname: "/gra/app/" };

test("na stronie z HTTPS kod QR prowadzi na ten sam adres", () => {
  assert.equal(phoneLink("lis", "sredni", https), "https://example.com/gra/app/?zwierze=lis&poziom=sredni");
});

test("z podglądu bez HTTPS kod QR prowadzi na opublikowaną grę", () => {
  const local = { protocol: "http:", origin: "http://localhost:8000", pathname: "/app/" };
  assert.equal(phoneLink("lis", "latwy", local), `${PUBLIC_URL}?zwierze=lis&poziom=latwy`);
  assert.ok(PUBLIC_URL.startsWith("https://"));
});

test("każde zwierzę i poziom wraca z adresu bez zmian", () => {
  for (const animal of ORDER) {
    for (const level of LEVEL_ORDER) {
      const { search } = new URL(phoneLink(animal, level, https));
      assert.deepEqual(readPhoneLink(search), { animal, level });
    }
  }
});

test("adres bez znanego zwierzęcia to zwykłe uruchomienie gry", () => {
  assert.equal(readPhoneLink(""), null);
  assert.equal(readPhoneLink("?poziom=latwy"), null);
  assert.equal(readPhoneLink("?zwierze=smok&poziom=latwy"), null);
  assert.equal(readPhoneLink("?zwierze=constructor"), null);
});

test("nieznany poziom liczy się jako łatwy", () => {
  assert.deepEqual(readPhoneLink("?zwierze=lis"), { animal: "lis", level: "latwy" });
  assert.deepEqual(readPhoneLink("?zwierze=lis&poziom=toString"), { animal: "lis", level: "latwy" });
});

test("czyszczenie adresu zostawia pozostałe parametry", () => {
  assert.equal(withoutPhoneLink({ pathname: "/app/", search: "?zwierze=lis&poziom=latwy" }), "/app/");
  assert.equal(withoutPhoneLink({ pathname: "/app/", search: "?ar=symulacja&zwierze=lis&poziom=latwy&debug=1" }), "/app/?ar=symulacja&debug=1");
});
