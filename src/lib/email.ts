import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type CfSendResult = {
  success?: boolean;
  errors?: { code?: number; message?: string }[];
  result?: {
    delivered?: unknown;
    queued?: unknown;
    permanent_bounces?: unknown;
    message_id?: string;
  };
};

export class EmailSendError extends Error {
  readonly code: "not_configured" | "invalid_from" | "send_failed";

  constructor(code: EmailSendError["code"], message: string) {
    super(message);
    this.name = "EmailSendError";
    this.code = code;
  }
}

const GENERIC_SEND_ERROR = "Não foi possível enviar o email. Tenta outra vez.";

export function staffEmailError(error: unknown): string {
  if (
    error instanceof EmailSendError &&
    (error.code === "not_configured" || error.code === "invalid_from")
  ) {
    return error.message;
  }
  return GENERIC_SEND_ERROR;
}

export function ownerEmailError(): string {
  return GENERIC_SEND_ERROR;
}

export function parseFromAddress(from: string): { address: string; name?: string } {
  const named = from.match(/^\s*(?:"?([^"<]*)"?\s*)<\s*([^<>]+)\s*>\s*$/);
  const address = (named ? named[2] : from).trim();
  const name = named?.[1].trim();
  if (!address.includes("@")) {
    throw new EmailSendError("invalid_from", "EMAIL_FROM inválido.");
  }
  return name ? { address, name } : { address };
}

export function resolveEmailTransport(env: NodeJS.ProcessEnv = process.env) {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID?.trim() ?? "";
  const apiToken = env.CLOUDFLARE_EMAIL_API_TOKEN?.trim() ?? "";
  const hasAccount = accountId.length > 0;
  const hasToken = apiToken.length > 0;

  if (hasAccount && hasToken) {
    return { mode: "remote" as const, accountId, apiToken };
  }
  if (hasAccount !== hasToken || env.NODE_ENV === "production") {
    throw new EmailSendError("not_configured", "Configuração de email em falta.");
  }
  return { mode: "local" as const };
}

function normalizeAddress(value: string) {
  return value.trim().toLowerCase();
}

function asAddressList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map(normalizeAddress);
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}) {
  const from = parseFromAddress(process.env.EMAIL_FROM ?? "Laro <propostas@laro.pt>");
  const transport = resolveEmailTransport();
  const replyTo = input.replyTo?.trim();

  if (transport.mode === "remote") {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(transport.accountId)}/email/sending/send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${transport.apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: input.to,
          subject: input.subject,
          html: input.html,
          text: input.text,
          ...(replyTo ? { reply_to: replyTo } : {}),
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );

    const body = (await response.json().catch(() => null)) as CfSendResult | null;
    const recipient = normalizeAddress(input.to);
    const delivered = asAddressList(body?.result?.delivered);
    const queued = asAddressList(body?.result?.queued);
    const bounces = asAddressList(body?.result?.permanent_bounces);
    const accepted = delivered.includes(recipient) || queued.includes(recipient);

    if (!response.ok || !body?.success || bounces.includes(recipient) || !accepted) {
      console.error("email.send failed", {
        status: response.status,
        cfCodes: (body?.errors ?? []).map((error) => error.code ?? error.message).slice(0, 5),
      });
      throw new EmailSendError("send_failed", GENERIC_SEND_ERROR);
    }

    return { delivered: true, id: body.result?.message_id ?? null };
  }

  const dir = path.join(process.cwd(), "storage", "emails");
  await mkdir(dir, { recursive: true });
  const filename = `${Date.now()}-${input.to.replace(/[^a-z0-9@._-]/gi, "_")}.html`;
  await writeFile(
    path.join(dir, filename),
    `<!-- to: ${input.to} | subject: ${input.subject}${replyTo ? ` | reply-to: ${replyTo}` : ""} -->\n${input.html}`,
    "utf8",
  );
  return { delivered: false, id: filename };
}
