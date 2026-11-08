import { test } from "node:test";
import assert from "node:assert/strict";
import { PUBLIC_URL, isHandheld, phoneLink, readPhoneLink } from "../app/js/telefon.js";
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

test("telefony i tablety to urządzenia w ręku, a monitor, także dotykowy, nie", () => {
  const android = "Mozilla/5.0 (Linux; Android 14; moto g13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";
  const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
  const tablet = "Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
  const windows = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
  const mac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
  assert.equal(isHandheld({ userAgent: android }), true);
  assert.equal(isHandheld({ userAgent: iphone }), true);
  assert.equal(isHandheld({ userAgent: tablet }), true);
  assert.equal(isHandheld({ userAgent: windows, userAgentData: { mobile: true } }), true);
  assert.equal(isHandheld({ userAgent: mac, platform: "MacIntel", maxTouchPoints: 5 }), true, "iPad udający Maca");
  assert.equal(isHandheld({ userAgent: windows, userAgentData: { mobile: false }, maxTouchPoints: 10, platform: "Win32" }), false, "dotykowy monitor na stanowisku");
  assert.equal(isHandheld({ userAgent: mac, platform: "MacIntel", maxTouchPoints: 0 }), false);
});
