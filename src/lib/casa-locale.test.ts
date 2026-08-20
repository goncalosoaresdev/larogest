import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  casaAlertTypeLabel,
  casaText,
  parseCasaLocale,
  switchCasaLocale,
} from "./casa-locale";

describe("casa locale lookup", () => {
  it("defaults unknown values to Portuguese", () => {
    assert.equal(parseCasaLocale(undefined), "pt");
    assert.equal(parseCasaLocale("fr"), "pt");
    assert.equal(parseCasaLocale("en"), "en");
  });

  it("returns settings title, quiet-hours line, history empty, and alert type in both languages", () => {
    assert.equal(casaText("pt", "settings.title"), "Definições");
    assert.equal(casaText("en", "settings.title"), "Settings");
    assert.equal(
      casaText("pt", "settings.dndHint"),
      "Só movimento e fugas de água passam. Os outros avisos ficam em silêncio.",
    );
    assert.equal(
      casaText("en", "settings.dndHint"),
      "Only motion and water leaks get through. Other alerts stay silent.",
    );
    assert.equal(casaText("pt", "history.empty"), "Ainda sem leituras nesta casa.");
    assert.equal(casaText("en", "history.empty"), "No readings in this house yet.");
    assert.equal(casaAlertTypeLabel("pt", "WATER_LEAK"), "Fuga de água");
    assert.equal(casaAlertTypeLabel("en", "WATER_LEAK"), "Water leak");
    assert.equal(casaText("pt", "hello.morning"), "Bom dia,");
    assert.equal(casaText("en", "hello.morning"), "Good morning,");
    assert.equal(casaText("pt", "login.title"), "Entrar na Pulse");
    assert.equal(casaText("en", "login.title"), "Sign in to Pulse");
    assert.equal(casaText("pt", "login.invalidCode"), "Código inválido ou expirado.");
    assert.equal(casaText("pt", "settings.signOut"), "Sair");
    assert.equal(casaText("en", "settings.signOut"), "Sign out");
    assert.equal(casaText("pt", "home.emptyTitle"), "Ainda sem casas Pulse");
    assert.equal(casaText("en", "home.emptyTitle"), "No Pulse houses yet");
  });

  it("switches from the default Portuguese locale to English", () => {
    const from = parseCasaLocale(undefined);
    assert.equal(from, "pt");
    assert.equal(casaText(from, "settings.title"), "Definições");
    const next = switchCasaLocale(from, "en");
    assert.equal(next, "en");
    assert.equal(casaText(next, "settings.title"), "Settings");
    assert.equal(casaText(next, "settings.dndHint").includes("water leaks"), true);
    assert.equal(casaAlertTypeLabel(next, "MOTION"), "Motion detected");
  });
});
