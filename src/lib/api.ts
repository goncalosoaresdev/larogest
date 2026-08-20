import { NextResponse } from "next/server";
import { getSession, getSessionRole } from "@/lib/session";

const NO_STORE = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
} as const;

const buckets = new Map<string, { count: number; resetAt: number }>();

export type ApiErrorCode =
  | "invalid_email"
  | "invalid_otp"
  | "invalid_body"
  | "unauthenticated"
  | "not_found"
  | "rate_limited"
  | "server_error"
  | "push_unconfigured";

export function jsonOk(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: NO_STORE });
}

export function jsonError(status: number, error: ApiErrorCode, extra?: Record<string, string>) {
  return NextResponse.json({ error }, { status, headers: { ...NO_STORE, ...extra } });
}

export function ownerAuthErrorCode(issues: { path: PropertyKey[] }[]): ApiErrorCode {
  const field = issues[0]?.path[0];
  if (field === "otp") return "invalid_otp";
  if (field === "email") return "invalid_email";
  return "invalid_body";
}

export function isCasaToken(token: string) {
  return /^[A-Za-z0-9_-]{20,32}$/.test(token);
}

export function clientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  return ip;
}

export function rateLimit(key: string, limit: number, windowMs = 60_000, now = Date.now()) {
  const current = buckets.get(key);
  if (!current || now >= current.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfter: Math.ceil(windowMs / 1000) };
  }
  if (current.count >= limit) {
    return { ok: false, remaining: 0, retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
  }
  current.count += 1;
  return { ok: true, remaining: limit - current.count, retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
}

export function limited(request: Request, name: string, limit: number) {
  const result = rateLimit(`${name}:${clientKey(request)}`, limit);
  if (result.ok) return null;
  return jsonError(429, "rate_limited", { "Retry-After": String(result.retryAfter) });
}

export async function requireApiSession() {
  const session = await getSession();
  if (!session || getSessionRole(session) !== "STAFF") {
    return { session: null, error: jsonError(401, "unauthenticated") };
  }
  return { session, error: null };
}

export function pdfContentDisposition(reference: string) {
  const base = reference.replace(/\.pdf$/i, "");
  const safe = base.replace(/[^\w.\-]+/g, "_").slice(0, 80) || "documento";
  return `inline; filename="${safe}.pdf"`;
}

export function parseJsonBody<T>(request: Request) {
  return request.json().then((value) => value as T).catch(() => null);
}

export function isHttpsUrl(value: string, max = 2048) {
  if (value.length < 12 || value.length > max) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

export function isPushKey(value: string, min = 8, max = 256) {
  return value.length >= min && value.length <= max && /^[A-Za-z0-9+/=_-]+$/.test(value);
}

export function isApnsToken(value: string) {
  return /^[0-9a-f]{64,200}$/i.test(value.replace(/\s/g, ""));
}

export function resetRateLimitForTests() {
  buckets.clear();
}
