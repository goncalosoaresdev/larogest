import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cn } from "./utils";

describe("cn", () => {
  it("merges conflicting Tailwind classes and drops falsy values", () => {
    assert.equal(cn("px-2", false && "hidden", "px-4"), "px-4");
    assert.equal(cn("text-sm", "font-medium"), "text-sm font-medium");
  });
});
