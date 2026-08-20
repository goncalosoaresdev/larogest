import { betterAuth, type BetterAuthPlugin } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { bearer, emailOTP } from "better-auth/plugins";
import { prisma } from "@/lib/prisma";
import { EmailSendError, ownerEmailError, sendEmail } from "@/lib/email";
import { rememberLocalOwnerOtp } from "@/lib/owner-auth";
import { normalizeOwnerEmail, OWNER_OTP_EXPIRES_IN } from "@/lib/owner-auth-core";

const googleEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
);

const OWNER_OTP_PATHS = new Set(["/email-otp/send-verification-otp", "/sign-in/email-otp"]);
const BLOCKED_OTP_PATHS = new Set([
  "/email-otp/request-password-reset",
  "/forget-password/email-otp",
  "/email-otp/reset-password",
  "/email-otp/request-email-change",
  "/email-otp/change-email",
  "/email-otp/verify-email",
]);

const ownerOtpGuard = {
  id: "owner-otp-guard",
  hooks: {
    before: [
      {
        matcher(ctx) {
          const path = ctx.path ?? "";
          return OWNER_OTP_PATHS.has(path) || BLOCKED_OTP_PATHS.has(path);
        },
        handler: createAuthMiddleware(async (ctx) => {
          const path = ctx.path ?? "";
          if (BLOCKED_OTP_PATHS.has(path)) {
            if (path.includes("request") || path.includes("forget")) {
              return ctx.json({ success: true });
            }
            throw APIError.from("BAD_REQUEST", { code: "INVALID_OTP", message: "INVALID_OTP" });
          }
          const email =
            typeof ctx.body?.email === "string" ? normalizeOwnerEmail(ctx.body.email) : "";
          const user = email
            ? await prisma.user.findUnique({ where: { email }, select: { role: true } })
            : null;
          const owner = user?.role === "OWNER";
          if (path === "/email-otp/send-verification-otp") {
            if (ctx.body?.type && ctx.body.type !== "sign-in") return ctx.json({ success: true });
            if (!owner) return ctx.json({ success: true });
            return;
          }
          if (!owner) throw APIError.from("BAD_REQUEST", { code: "INVALID_OTP", message: "INVALID_OTP" });
        }),
      },
    ],
  },
} satisfies BetterAuthPlugin;

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: [
    process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3002",
  ],
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: googleEnabled
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        },
      }
    : undefined,
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "STAFF",
        input: false,
      },
    },
  },
  plugins: [
    ownerOtpGuard,
    bearer(),
    emailOTP({
      otpLength: 6,
      expiresIn: OWNER_OTP_EXPIRES_IN,
      disableSignUp: true,
      storeOTP: "hashed",
      allowedAttempts: 3,
      async sendVerificationOTP({ email, otp, type }) {
        if (type !== "sign-in") return;
        const user = await prisma.user.findUnique({
          where: { email: normalizeOwnerEmail(email) },
          select: { role: true },
        });
        if (user?.role !== "OWNER") return;
        try {
          const sent = await sendEmail({
            to: email,
            subject: "Código Laro Pulse",
            html: `<p>O teu código para entrar na Laro Pulse é:</p>
<p style="font-size:28px;letter-spacing:6px"><strong>${otp}</strong></p>
<p>Expira em 5 minutos. Se não pediste este código, ignora o email.</p>`,
            text: `Código: ${otp}. Expira em 5 minutos.`,
          });
          if (!sent.delivered && process.env.NODE_ENV !== "production") {
            rememberLocalOwnerOtp(email, otp);
          }
        } catch (error) {
          console.error("owner.otp.email failed");
          throw error instanceof EmailSendError ? error : new EmailSendError("send_failed", ownerEmailError());
        }
      },
    }),
    nextCookies(),
  ],
});
