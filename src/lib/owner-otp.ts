import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/api";
import { resolveEmailTransport } from "@/lib/email";
import {
  ensureOwnerUser,
  findEligibleOwnerPersons,
  isOwnerEmailFormat,
  normalizeOwnerEmail,
  takeLocalOwnerOtp,
} from "@/lib/owner-auth";

const OTP_WINDOW_MS = 10 * 60_000;
const OTP_LIMIT = 5;

export type RequestOwnerOtpResult =
  | { ok: false; error: "invalid_email" | "rate_limit" }
  | { ok: true; preview?: true; previewCode?: string };

export async function sendOwnerSignInOtp(
  email: string,
  input: { ip: string; headers: Headers },
): Promise<RequestOwnerOtpResult> {
  const normalized = normalizeOwnerEmail(email ?? "");
  if (!isOwnerEmailFormat(normalized)) {
    return { ok: false, error: "invalid_email" };
  }

  const ipLimit = rateLimit(`owner-otp:ip:${input.ip || "unknown"}`, OTP_LIMIT, OTP_WINDOW_MS);
  const emailLimit = rateLimit(`owner-otp:email:${normalized}`, OTP_LIMIT, OTP_WINDOW_MS);
  if (!ipLimit.ok || !emailLimit.ok) {
    return { ok: false, error: "rate_limit" };
  }

  const persons = await findEligibleOwnerPersons(normalized);
  if (persons.length === 0) {
    return { ok: true };
  }

  const ensured = await ensureOwnerUser(normalized);
  if (!ensured.ok) {
    return { ok: true };
  }

  try {
    await auth.api.sendVerificationOTP({
      body: { email: normalized, type: "sign-in" },
      headers: input.headers,
    });
  } catch {
    console.error("owner.otp.send failed");
    return { ok: true };
  }

  let localPreview = false;
  if (process.env.NODE_ENV !== "production") {
    try {
      localPreview = resolveEmailTransport().mode === "local";
    } catch {
      localPreview = false;
    }
  }
  if (!localPreview) return { ok: true };

  const previewCode = takeLocalOwnerOtp(normalized);
  return previewCode ? { ok: true, preview: true, previewCode } : { ok: true, preview: true };
}
