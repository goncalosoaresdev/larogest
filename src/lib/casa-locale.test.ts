import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  casaAlertMarkLabel,
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
    assert.equal(casaText("pt", "demo.house"), "Casa de Campo");
    assert.equal(casaText("en", "demo.house"), "Country house");
    assert.equal(casaText("pt", "demo.badge"), "Demo");
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
    assert.equal(casaText("pt", "today.quiet"), "Dia calmo até agora.");
    assert.equal(casaText("en", "today.quiet"), "A quiet day so far.");
    assert.equal(casaText("pt", "today.many", { n: 3 }), "3 ocorrências hoje");
    assert.equal(casaText("en", "today.one"), "1 event today");
    assert.equal(casaText("pt", "chart.open"), "Em aberto");
    assert.equal(casaText("pt", "alerts.open"), "Em aberto");
    assert.equal(casaText("pt", "alerts.emptyLead"), "Se algo mudar na casa, aparece aqui. A Laro recebe o mesmo aviso.");
    assert.equal(casaText("en", "alerts.calmNote"), "Nothing open. If something changes, the alert lands here and on your phone.");
    assert.equal(casaAlertMarkLabel("pt", "MOTION"), "Movimento");
    assert.equal(casaAlertMarkLabel("en", "WATER_LEAK"), "Leak");
    assert.equal(casaText("pt", "hello.morning"), "Bom dia,");
    assert.equal(casaText("en", "hello.morning"), "Good morning,");
    assert.equal(casaText("pt", "login.title"), "A sua casa, sempre por perto.");
    assert.equal(casaText("en", "login.title"), "Your house, always nearby.");
    assert.equal(casaText("pt", "login.emailPlaceholder"), "Email da casa");
    assert.equal(casaText("pt", "login.secure"), "Acesso seguro por código");
    assert.equal(casaText("pt", "login.codeHint", { time: "4:32" }), "O código expira em 4:32");
    assert.equal(casaText("en", "login.codeHint", { time: "4:32" }), "The code expires in 4:32");
    assert.equal(casaText("pt", "login.codeExpired"), "O código expirou. Pede um novo.");
    assert.equal(casaText("pt", "login.invalidCode"), "Código inválido ou expirado.");
    assert.equal(casaText("pt", "settings.signOut"), "Sair");
    assert.equal(casaText("en", "settings.signOut"), "Sign out");
    assert.equal(casaText("pt", "home.emptyTitle"), "Ainda sem casas Pulse");
    assert.equal(casaText("pt", "tab.reports"), "Relatórios");
    assert.equal(casaText("en", "tab.reports"), "Reports");
    assert.equal(casaText("pt", "reports.empty"), "Quando a Laro visitar, o relatório aparece aqui.");
    assert.equal(casaText("pt", "reports.check.doors"), "Portas");
    assert.equal(casaText("en", "reports.check.attention"), "Needs attention");
    assert.equal(casaText("pt", "reports.line.ok"), "A casa está bem.");
    assert.equal(casaText("en", "reports.line.ok"), "The house is fine.");
    assert.equal(casaText("pt", "reports.line.urgent"), "Precisa de atenção agora.");
    assert.equal(casaText("pt", "reports.covered"), "Verificado");
    assert.equal(casaText("en", "reports.covered"), "Checked");
    assert.equal(casaText("pt", "reports.seal"), "Visita verificada");
    assert.equal(casaText("pt", "reports.photos.many", { n: 3 }), "3 fotos");
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
