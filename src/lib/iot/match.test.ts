import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { expectedLocationNames, matchProviderLocation } from "./match";
import type { ProviderLocation } from "./types";

const homes: ProviderLocation[] = [
  { id: "1", name: "Casa Maria Porto" },
  { id: "2", name: "Escritório Lisboa" },
  { id: "3", name: "Casa João Gaia" },
];

describe("matchProviderLocation", () => {
  it("returns the unique high-scoring home", () => {
    const match = matchProviderLocation(homes, { ownerName: "Maria", city: "Porto" });
    assert.equal(match?.id, "1");
    assert.equal(match?.name, "Casa Maria Porto");
  });

  it("returns null when two homes score too closely", () => {
    const twins: ProviderLocation[] = [
      { id: "a", name: "Casa Silva Porto" },
      { id: "b", name: "Casa Silva Gaia" },
    ];
    assert.equal(matchProviderLocation(twins, { ownerName: "Silva" }), null);
  });

  it("skips already taken ids", () => {
    const match = matchProviderLocation(homes, { ownerName: "Maria", city: "Porto" }, ["1"]);
    assert.equal(match, null);
  });

  it("returns null when hints are too short to score", () => {
    assert.equal(matchProviderLocation(homes, { city: "ab" }), null);
  });
});

describe("expectedLocationNames", () => {
  it("dedupes trimmed owner, city, and address", () => {
    assert.deepEqual(
      expectedLocationNames({
        ownerName: " Maria ",
        city: "Porto",
        address: "Porto",
      }),
      ["Maria", "Porto"],
    );
  });
});
