export const MOTION_SESSION_MS = 20 * 60_000;

export function readLastMotionAt(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const value = (payload as Record<string, unknown>).lastMotionAt;
  if (typeof value !== "string") return null;
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? null : at;
}

export function nextLastMotionAt(input: {
  motion: boolean | undefined;
  previousMotion: boolean | undefined;
  previousLastMotionAt: Date | null;
  now: Date;
}) {
  if (input.motion === true) return input.now;
  if (input.previousMotion === true) return input.now;
  return input.previousLastMotionAt;
}

export function shouldOpenMotionAlert(previousMotion: boolean | undefined, motion: boolean | undefined) {
  return motion === true && previousMotion !== true;
}

export function motionSessionExpired(input: {
  lastMotionAt: Date | null;
  now: Date;
  sessionMs?: number;
}) {
  if (!input.lastMotionAt) return true;
  const windowMs = input.sessionMs ?? MOTION_SESSION_MS;
  return input.now.getTime() - input.lastMotionAt.getTime() >= windowMs;
}

export function withLastMotionAt(reading: object, lastMotionAt: Date | null) {
  if (!lastMotionAt) return reading;
  return { ...reading, lastMotionAt: lastMotionAt.toISOString() };
}
