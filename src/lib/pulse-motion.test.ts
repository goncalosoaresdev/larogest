import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MOTION_SESSION_MS,
  motionSessionExpired,
  nextLastMotionAt,
  readLastMotionAt,
  shouldOpenMotionAlert,
  withLastMotionAt,
} from "./pulse-motion";

describe("motionSessionExpired", () => {
  const now = new Date("2026-08-21T12:00:00.000Z");

  it("keeps the session open until 20 minutes after the last motion", () => {
    assert.equal(MOTION_SESSION_MS, 20 * 60_000);
    assert.equal(motionSessionExpired({ lastMotionAt: now, now }), false);
    assert.equal(
      motionSessionExpired({ lastMotionAt: new Date(now.getTime() - MOTION_SESSION_MS + 1), now }),
      false,
    );
    assert.equal(
      motionSessionExpired({ lastMotionAt: new Date(now.getTime() - MOTION_SESSION_MS), now }),
      true,
    );
  });

  it("expires when there is no last motion, and honours a custom window", () => {
    assert.equal(motionSessionExpired({ lastMotionAt: null, now }), true);
    assert.equal(
      motionSessionExpired({
        lastMotionAt: new Date(now.getTime() - 60_000),
        now,
        sessionMs: 30_000,
      }),
      true,
    );
  });
});

describe("nextLastMotionAt", () => {
  const now = new Date("2026-08-21T12:00:00.000Z");
  const stamped = new Date("2026-08-21T11:40:00.000Z");

  it("starts the quiet clock on the falling edge, not a stale lastSeenAt", () => {
    assert.equal(
      nextLastMotionAt({
        motion: true,
        previousMotion: false,
        previousLastMotionAt: stamped,
        now,
      }),
      now,
    );
    assert.equal(
      nextLastMotionAt({
        motion: false,
        previousMotion: true,
        previousLastMotionAt: stamped,
        now,
      }),
      now,
    );
    assert.equal(
      nextLastMotionAt({
        motion: false,
        previousMotion: false,
        previousLastMotionAt: stamped,
        now,
      }),
      stamped,
    );
  });
});

describe("shouldOpenMotionAlert", () => {
  it("opens only on the rising edge", () => {
    assert.equal(shouldOpenMotionAlert(false, true), true);
    assert.equal(shouldOpenMotionAlert(undefined, true), true);
    assert.equal(shouldOpenMotionAlert(true, true), false);
    assert.equal(shouldOpenMotionAlert(true, false), false);
    assert.equal(shouldOpenMotionAlert(false, false), false);
  });
});

describe("readLastMotionAt", () => {
  it("reads a stored ISO stamp and ignores junk", () => {
    assert.equal(readLastMotionAt({ lastMotionAt: "2026-08-21T11:40:00.000Z" })?.toISOString(), "2026-08-21T11:40:00.000Z");
    assert.equal(readLastMotionAt({ lastMotionAt: "nope" }), null);
    assert.equal(readLastMotionAt(null), null);
    assert.deepEqual(withLastMotionAt({ motion: false }, new Date("2026-08-21T11:40:00.000Z")), {
      motion: false,
      lastMotionAt: "2026-08-21T11:40:00.000Z",
    });
  });
});
