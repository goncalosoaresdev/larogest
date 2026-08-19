import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildMergeContext, sectionsFromSnapshot, snapshotDocument } from "./documents";
import { formatDateLong, formatMoney, formatPercent } from "./format";

const baseInput = {
  owner: {
    name: "Maria Silva",
    email: "maria@example.com",
    phone: "910000000",
    nif: "123456789",
    address: "Rua A",
    companyName: null,
  },
  property: {
    address: "Rua das Flores 1",
    city: "Porto",
    typology: "APARTMENT" as const,
    capacity: 4,
    rnal: null,
  },
  company: {
    name: "Laro",
    nif: "500",
    address: "Porto",
    email: "ola@laro.pt",
    phone: "220000000",
  },
  proposal: {
    reference: "LARO-P-2026-001",
    package: "FULL_MANAGEMENT" as const,
    commissionPct: 18,
    commissionBase: "GROSS" as const,
    setupFee: 250,
    photographyFee: null,
    reserveFundPct: null,
    includedServices: "",
    extraServices: "",
    validUntil: new Date(2026, 8, 1),
  },
  lead: { service: "AL_MANAGEMENT" as const },
};

describe("buildMergeContext", () => {
  it("maps labels, money, and fallbacks through the real formatters", () => {
    const ctx = buildMergeContext(baseInput);
    assert.equal(ctx.owner.name, "Maria Silva");
    assert.equal(ctx.owner.companyName, "");
    assert.equal(ctx.property.typology, "Apartamento");
    assert.equal(ctx.property.rnal, "por licenciar");
    assert.equal(ctx.proposal.package, "Gestão completa");
    assert.equal(ctx.proposal.commissionPct, formatPercent(18));
    assert.equal(ctx.proposal.setupFee, formatMoney(250));
    assert.equal(ctx.proposal.photographyFee, "—");
    assert.equal(ctx.proposal.validUntil, formatDateLong(new Date(2026, 8, 1)));
    assert.equal(ctx.proposal.included, "Nada a acrescentar ao pacote-base.");
    assert.equal(ctx.lead.service, "Gestão de AL");
    assert.deepEqual(ctx.contract, {});
    assert.equal(ctx.company.email, "ola@laro.pt");
  });

  it("includes contract dates when provided", () => {
    const ctx = buildMergeContext({
      ...baseInput,
      contract: {
        reference: "LARO-C-2026-001",
        startsOn: new Date(2026, 8, 1),
        endsOn: new Date(2027, 7, 31),
        noticeDays: 30,
      },
    });
    assert.equal(ctx.contract.reference, "LARO-C-2026-001");
    assert.equal(ctx.contract.noticeDays, "30");
    assert.equal(ctx.contract.startsOn, formatDateLong(new Date(2026, 8, 1)));
  });
});

describe("sectionsFromSnapshot", () => {
  it("returns sections only from a well-formed snapshot", () => {
    assert.deepEqual(sectionsFromSnapshot(null), []);
    assert.deepEqual(sectionsFromSnapshot("nope"), []);
    assert.deepEqual(sectionsFromSnapshot({}), []);
    const sections = [{ id: "s1", title: "A", body: "B" }];
    assert.deepEqual(sectionsFromSnapshot({ sections }), sections);
  });
});

describe("snapshotDocument", () => {
  it("merges placeholders with the built context", () => {
    const context = buildMergeContext(baseInput);
    const snap = snapshotDocument({
      sections: [{ id: "s1", title: "Olá {{owner.name}}", body: "{{property.city}}" }],
      context,
      templateId: "tpl",
      templateVersion: 2,
    });
    assert.equal(snap.templateId, "tpl");
    assert.equal(snap.templateVersion, 2);
    assert.equal(snap.sections[0].title, "Olá Maria Silva");
    assert.equal(snap.sections[0].body, "Porto");
    assert.match(snap.mergedAt, /^\d{4}-\d{2}-\d{2}T/);
  });
});
