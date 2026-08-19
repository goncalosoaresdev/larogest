import { createHash, randomInt } from "node:crypto";

export function hashOtp(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

export function generateOtp() {
  return String(randomInt(100000, 1000000));
}

export function hashBuffer(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}
