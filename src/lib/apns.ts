import { createPrivateKey, sign } from "node:crypto";
import { connect } from "node:http2";

export type ApnsConfig = {
  keyId: string;
  teamId: string;
  bundleId: string;
  p8: string;
  production: boolean;
};

export type CasaPushPayload = {
  title: string;
  body: string;
  siteId: string;
  type: string;
  url: string;
};

type ApnsSendResult = { ok: true } | { ok: false; dead: boolean };

let jwtCache: { token: string; exp: number } | null = null;

export function apnsConfig(env: Record<string, string | undefined> = process.env): ApnsConfig | null {
  const keyId = env.APNS_KEY_ID?.trim();
  const teamId = env.APNS_TEAM_ID?.trim();
  const bundleId = env.APNS_BUNDLE_ID?.trim();
  const p8 = env.APNS_P8?.trim();
  if (!keyId || !teamId || !bundleId || !p8) return null;
  return { keyId, teamId, bundleId, p8, production: env.APNS_PRODUCTION === "true" };
}

export function resetApnsJwtForTests() {
  jwtCache = null;
}

export async function sendApnsAlert(config: ApnsConfig, token: string, payload: CasaPushPayload): Promise<ApnsSendResult> {
  const host = config.production ? "api.push.apple.com" : "api.sandbox.push.apple.com";
  const body = JSON.stringify({
    aps: {
      alert: { title: payload.title, body: payload.body },
      sound: "default",
      "thread-id": payload.siteId,
    },
    siteId: payload.siteId,
    type: payload.type,
    url: payload.url,
  });

  return new Promise((resolve, reject) => {
    const client = connect(`https://${host}`);
    client.on("error", reject);

    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${token}`,
      authorization: `bearer ${apnsJwt(config)}`,
      "apns-topic": config.bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "apns-collapse-id": payload.siteId.slice(0, 64),
      "content-type": "application/json",
    });

    let status = 0;
    let raw = "";
    req.on("response", (headers) => {
      status = Number(headers[":status"] ?? 0);
    });
    req.on("data", (chunk: Buffer | string) => {
      raw += chunk.toString();
    });
    req.on("error", reject);
    req.on("end", () => {
      client.close();
      if (status === 200) {
        resolve({ ok: true });
        return;
      }
      let reason = "";
      try {
        reason = String((JSON.parse(raw) as { reason?: string }).reason ?? "");
      } catch {
        reason = "";
      }
      resolve({
        ok: false,
        dead: status === 410 || reason === "BadDeviceToken" || reason === "Unregistered" || reason === "DeviceTokenNotForTopic",
      });
    });
    req.end(body);
  });
}

function apnsJwt(config: ApnsConfig) {
  if (jwtCache && jwtCache.exp > Date.now() + 60_000) return jwtCache.token;

  const header = Buffer.from(JSON.stringify({ alg: "ES256", kid: config.keyId })).toString("base64url");
  const iat = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ iss: config.teamId, iat })).toString("base64url");
  const key = createPrivateKey({ key: normalizeP8(config.p8), format: "pem" });
  const signature = sign("SHA256", Buffer.from(`${header}.${payload}`), { key, dsaEncoding: "ieee-p1363" });
  const token = `${header}.${payload}.${signature.toString("base64url")}`;
  jwtCache = { token, exp: Date.now() + 50 * 60_000 };
  return token;
}

function normalizeP8(value: string) {
  const pem = value.replaceAll("\\n", "\n").trim();
  if (pem.includes("BEGIN")) return pem;
  return `-----BEGIN PRIVATE KEY-----\n${pem}\n-----END PRIVATE KEY-----`;
}
