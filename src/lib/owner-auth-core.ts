import { z } from "zod";

const ownerEmailSchema = z.string().trim().email();

export const OWNER_OTP_EXPIRES_IN = 300;
export const OWNER_OTP_TTL_MS = OWNER_OTP_EXPIRES_IN * 1000;

export function otpSecondsLeft(expiresAt: number, now: number) {
  return Math.max(0, Math.ceil((expiresAt - now) / 1000));
}

export function formatOtpCountdown(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const mm = Math.floor(safe / 60);
  const ss = safe % 60;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

const localOtpPreview = new Map<string, { otp: string; at: number }>();

export function normalizeOwnerEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isOwnerEmailFormat(email: string) {
  return ownerEmailSchema.safeParse(email).success;
}

export function personEmailMatches(personEmail: string | null | undefined, email: string) {
  if (!personEmail) return false;
  return normalizeOwnerEmail(personEmail) === normalizeOwnerEmail(email);
}

export function rememberLocalOwnerOtp(email: string, otp: string) {
  localOtpPreview.set(normalizeOwnerEmail(email), { otp, at: Date.now() });
}

export function takeLocalOwnerOtp(email: string) {
  const key = normalizeOwnerEmail(email);
  const entry = localOtpPreview.get(key);
  if (!entry) return null;
  localOtpPreview.delete(key);
  if (Date.now() - entry.at > 30_000) return null;
  return entry.otp;
}

export function ownerCanAccessSite(
  user: { id: string; email: string },
  person: { userId: string | null; email: string | null },
) {
  if (person.userId) return person.userId === user.id;
  return personEmailMatches(person.email, user.email);
}

export function safeCasaNext(value: string | null | undefined) {
  if (!value) return null;
  const path = value.split(/[?#]/, 1)[0] ?? "";
  if (path.includes("\\") || path.includes("..") || path.includes("://")) return null;
  if (path === "/casa/entrar" || path.startsWith("/casa/entrar/")) return null;
  if (path === "/casa" || path.startsWith("/casa/")) return path;
  return null;
}
