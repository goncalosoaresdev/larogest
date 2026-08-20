import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatOtpCountdown,
  isOwnerEmailFormat,
  normalizeOwnerEmail,
  otpSecondsLeft,
  ownerCanAccessSite,
  personEmailMatches,
  rememberLocalOwnerOtp,
  safeCasaNext,
  takeLocalOwnerOtp,
} from "./owner-auth-core";

describe("normalizeOwnerEmail", () => {
  it("trims and lowercases", () => {
    assert.equal(normalizeOwnerEmail("  maria.silva@Laro.PT "), "maria.silva@laro.pt");
    assert.equal(normalizeOwnerEmail("ola@laro.pt"), "ola@laro.pt");
  });
});

describe("isOwnerEmailFormat", () => {
  it("accepts a normal email and rejects junk", () => {
    assert.equal(isOwnerEmailFormat("maria@laro.pt"), true);
    assert.equal(isOwnerEmailFormat("  maria@laro.pt  "), true);
    assert.equal(isOwnerEmailFormat("not-an-email"), false);
    assert.equal(isOwnerEmailFormat(""), false);
    assert.equal(isOwnerEmailFormat("maria@"), false);
  });
});

describe("personEmailMatches", () => {
  it("matches person emails case-insensitively after normalize", () => {
    assert.equal(personEmailMatches("Maria@Laro.PT", " maria@laro.pt "), true);
    assert.equal(personEmailMatches("outra@laro.pt", "maria@laro.pt"), false);
    assert.equal(personEmailMatches(null, "maria@laro.pt"), false);
    assert.equal(personEmailMatches("   ", "maria@laro.pt"), false);
  });
});

describe("local owner OTP preview stash", () => {
  it("returns a remembered code once, then forgets it", () => {
    rememberLocalOwnerOtp("Maria@Laro.PT", "123456");
    assert.equal(takeLocalOwnerOtp(" maria@laro.pt "), "123456");
    assert.equal(takeLocalOwnerOtp("maria@laro.pt"), null);
  });
});

describe("ownerCanAccessSite", () => {
  const user = { id: "u1", email: "maria@laro.pt" };

  it("matches a linked person or the same email", () => {
    assert.equal(ownerCanAccessSite(user, { userId: "u1", email: "outra@laro.pt" }), true);
    assert.equal(ownerCanAccessSite(user, { userId: null, email: "Maria@Laro.PT" }), true);
    assert.equal(ownerCanAccessSite(user, { userId: "u2", email: "outra@laro.pt" }), false);
    assert.equal(ownerCanAccessSite(user, { userId: "u2", email: "maria@laro.pt" }), false);
  });
});

describe("otp countdown", () => {
  it("clamps remaining seconds and formats mm:ss", () => {
    assert.equal(otpSecondsLeft(10_000, 7_000), 3);
    assert.equal(otpSecondsLeft(10_000, 9_400), 1);
    assert.equal(otpSecondsLeft(10_000, 10_000), 0);
    assert.equal(otpSecondsLeft(10_000, 12_000), 0);
    assert.equal(formatOtpCountdown(300), "5:00");
    assert.equal(formatOtpCountdown(299), "4:59");
    assert.equal(formatOtpCountdown(61), "1:01");
    assert.equal(formatOtpCountdown(9), "0:09");
    assert.equal(formatOtpCountdown(0), "0:00");
    assert.equal(formatOtpCountdown(-4), "0:00");
  });
});

describe("safeCasaNext", () => {
  it("keeps in-app casa paths and rejects protocol-relative URLs", () => {
    assert.equal(safeCasaNext("/casa"), "/casa");
    assert.equal(safeCasaNext("/casa/clxyz"), "/casa/clxyz");
    assert.equal(safeCasaNext("/casa/entrar"), null);
    assert.equal(safeCasaNext("/casa/../leads"), null);
    assert.equal(safeCasaNext("//evil.example"), null);
    assert.equal(safeCasaNext("/casattack"), null);
    assert.equal(safeCasaNext("/pulse"), null);
    assert.equal(safeCasaNext(null), null);
  });
});
