import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergeSections, mergeText, newSection } from "./merge";

describe("mergeText", () => {
  it("replaces dotted paths and uses an em dash for missing values", () => {
    const text = mergeText("Olá {{ owner.name }} — {{owner.email}} / {{missing}}", {
      owner: { name: "Maria", email: "" },
    });
    assert.equal(text, "Olá Maria — — / —");
  });

  it("stringifies nested numbers and leaves unknown tokens as em dashes", () => {
    assert.equal(mergeText("taxa {{proposal.pct}}%", { proposal: { pct: 18 } }), "taxa 18%");
  });
});

describe("mergeSections", () => {
  it("merges title and body without mutating the source section", () => {
    const source = { id: "s1", title: "Para {{owner.name}}", body: "NIF {{owner.nif}}" };
    const merged = mergeSections([source], { owner: { name: "Laro", nif: "500" } });
    assert.deepEqual(merged, [{ id: "s1", title: "Para Laro", body: "NIF 500" }]);
    assert.equal(source.title, "Para {{owner.name}}");
  });
});

describe("newSection", () => {
  it("creates an 8-char id and the default Portuguese title", () => {
    const section = newSection();
    assert.equal(section.title, "Nova secção");
    assert.equal(section.body, "");
    assert.equal(section.id.length, 8);
    assert.notEqual(newSection("Cláusulas").id, section.id);
    assert.equal(newSection("Cláusulas").title, "Cláusulas");
  });
});
