import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  isCasaToken,
  isHttpsUrl,
  isPushKey,
  limited,
  ownerAuthErrorCode,
  pdfContentDisposition,
  rateLimit,
  resetRateLimitForTests,
} from "./api";
import { ownerOtpEmailSchema, ownerOtpVerifySchema } from "./validations";
import { readPdf } from "./storage";

function failIssues(parsed: { success: true } | { success: false; error: { issues: { path: PropertyKey[] }[] } }) {
  assert.equal(parsed.success, false);
  if (parsed.success) throw new Error("expected parse to fail");
  return parsed.error.issues;
}

describe("api helpers", () => {
  beforeEach(() => resetRateLimitForTests());

  it("accepts nanoid casa tokens and rejects junk", () => {
    assert.equal(isCasaToken("JzKDOzcJ4PU9DIEuYfrAcHFv"), true);
    assert.equal(isCasaToken("../etc/passwd"), false);
    assert.equal(isCasaToken("short"), false);
    assert.equal(isCasaToken(""), false);
  });

  it("rate-limits after the window fills", () => {
    const first = rateLimit("test:1", 2, 60_000, 1000);
    const second = rateLimit("test:1", 2, 60_000, 1000);
    const third = rateLimit("test:1", 2, 60_000, 1000);
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(third.ok, false);
    assert.equal(rateLimit("test:1", 2, 60_000, 61_000).ok, true);
  });

  it("sanitizes PDF filenames and validates push inputs", () => {
    assert.equal(pdfContentDisposition('LARO/C-2026"x.pdf'), 'inline; filename="LARO_C-2026_x.pdf"');
    assert.equal(pdfContentDisposition("LARO-C-2026-001"), 'inline; filename="LARO-C-2026-001.pdf"');
    assert.equal(isHttpsUrl("https://fcm.googleapis.com/fcm/send/abc"), true);
    assert.equal(isHttpsUrl("http://evil.example/hook"), false);
    assert.equal(isPushKey("BNabcdefghijklmnopqrstuvwxyz012345"), true);
    assert.equal(isPushKey("no spaces!"), false);
  });

  it("maps owner auth Zod issues to stable error codes", () => {
    assert.equal(ownerAuthErrorCode(failIssues(ownerOtpEmailSchema.safeParse(null))), "invalid_body");
    assert.equal(ownerAuthErrorCode(failIssues(ownerOtpEmailSchema.safeParse({}))), "invalid_email");
    assert.equal(
      ownerAuthErrorCode(failIssues(ownerOtpEmailSchema.safeParse({ email: "not-an-email" }))),
      "invalid_email",
    );
    assert.equal(
      ownerAuthErrorCode(failIssues(ownerOtpVerifySchema.safeParse({ email: "maria@laro.pt" }))),
      "invalid_otp",
    );
    assert.equal(
      ownerAuthErrorCode(failIssues(ownerOtpVerifySchema.safeParse({ email: "maria@laro.pt", otp: "12" }))),
      "invalid_otp",
    );
  });

  it("returns rate_limited when the route bucket is full", async () => {
    const request = new Request("http://localhost/api/casa", {
      headers: { "x-forwarded-for": "203.0.113.8" },
    });
    assert.equal(limited(request, "api-test", 2), null);
    assert.equal(limited(request, "api-test", 2), null);
    const blocked = limited(request, "api-test", 2);
    assert.ok(blocked);
    assert.equal(blocked.status, 429);
    assert.equal(blocked.headers.get("Retry-After"), "60");
    assert.deepEqual(await blocked.json(), { error: "rate_limited" });
  });

  it("rejects pdf path traversal", async () => {
    await assert.rejects(() => readPdf("../secret.pdf"));
    await assert.rejects(() => readPdf("/tmp/secret.pdf"));
  });
});
