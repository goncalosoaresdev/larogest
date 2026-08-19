import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import { generateOtp, hashBuffer, hashOtp } from "./crypto";

describe("hashOtp", () => {
  it("returns the SHA-256 hex of the code", () => {
    const digest = hashOtp("123456");
    assert.equal(digest, createHash("sha256").update("123456").digest("hex"));
    assert.equal(digest.length, 64);
    assert.notEqual(hashOtp("123456"), hashOtp("123457"));
  });
});

describe("generateOtp", () => {
  it("returns a 6-digit code in the 100000–999999 range", () => {
    for (let i = 0; i < 20; i += 1) {
      const code = generateOtp();
      assert.match(code, /^\d{6}$/);
      const value = Number(code);
      assert.ok(value >= 100000 && value <= 999999);
    }
  });
});

describe("hashBuffer", () => {
  it("hashes the exact buffer contents", () => {
    const buffer = Buffer.from("contrato-laro");
    assert.equal(hashBuffer(buffer), createHash("sha256").update(buffer).digest("hex"));
  });
});
