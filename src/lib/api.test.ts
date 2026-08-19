import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  isCasaToken,
  isHttpsUrl,
  isPushKey,
  pdfContentDisposition,
  rateLimit,
  resetRateLimitForTests,
} from "./api";
import { readPdf } from "./storage";

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

  it("rejects pdf path traversal", async () => {
    await assert.rejects(() => readPdf("../secret.pdf"));
    await assert.rejects(() => readPdf("/tmp/secret.pdf"));
  });
});
