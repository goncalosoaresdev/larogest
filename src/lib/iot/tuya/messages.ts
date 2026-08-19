import { createDecipheriv, createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import WebSocket from "ws";

export const TUYA_MESSAGE_URLS = {
  CN: "wss://mqe.tuyacn.com:8285/",
  US: "wss://mqe.tuyaus.com:8285/",
  EU: "wss://mqe.tuyaeu.com:8285/",
  IN: "wss://mqe.tuyain.com:8285/",
  SG: "wss://mqe-sg.iotbing.com:8285/",
} as const;

export type TuyaMessageRegion = keyof typeof TUYA_MESSAGE_URLS;
export type TuyaMessageEnv = "prod" | "test";

export type TuyaMessageStatusItem = {
  code?: string;
  value?: unknown;
  t?: number;
};

export type TuyaDeviceEvent = {
  deviceId: string;
  protocol: number;
  bizCode?: string;
  online?: boolean;
  status: TuyaMessageStatusItem[];
  inventoryChanged: boolean;
};

type TuyaMessageEvents = {
  event: [TuyaDeviceEvent];
  open: [];
  close: [code: number, reason: string];
  error: [error: Error];
};

export function tuyaRegionFromBaseUrl(baseUrl: string): TuyaMessageRegion {
  if (baseUrl.includes("tuyacn")) return "CN";
  if (baseUrl.includes("tuyaus")) return "US";
  if (baseUrl.includes("tuyain")) return "IN";
  if (baseUrl.includes("iotbing") || baseUrl.includes("tuyasg")) return "SG";
  return "EU";
}

function md5Hex(value: string) {
  return createHash("md5").update(value).digest("hex");
}

function buildPassword(accessId: string, accessKey: string) {
  return md5Hex(`${accessId}${md5Hex(accessKey)}`).slice(8, 24);
}

function topicUrl(region: TuyaMessageRegion, accessId: string, env: TuyaMessageEnv) {
  const channel = env === "test" ? "event-test" : "event";
  const query = "subscriptionType=Failover&ackTimeoutMillis=30000";
  return `${TUYA_MESSAGE_URLS[region]}ws/v2/consumer/persistent/${accessId}/out/${channel}/${accessId}-sub?${query}`;
}

function decryptEcb(data: string, accessKey: string) {
  const decipher = createDecipheriv("aes-128-ecb", Buffer.from(accessKey.slice(8, 24), "utf8"), null);
  decipher.setAutoPadding(true);
  const plain = Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
  return JSON.parse(plain) as unknown;
}

function decryptGcm(data: string, accessKey: string) {
  const blob = Buffer.from(data, "base64");
  const iv = blob.subarray(0, 12);
  const tag = blob.subarray(-16);
  const cipher = blob.subarray(12, blob.length - 16);
  const decipher = createDecipheriv("aes-128-gcm", accessKey.slice(8, 24), iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(cipher), decipher.final()]).toString("utf8");
  return JSON.parse(plain) as unknown;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asStatusList(value: unknown): TuyaMessageStatusItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((item) => ({
      code: typeof item.code === "string" ? item.code : undefined,
      value: item.value,
      t: typeof item.t === "number" ? item.t : typeof item.time === "number" ? item.time : undefined,
    }));
}

const INVENTORY_CODES = new Set([
  "bindUser",
  "delete",
  "deviceBindSpace",
  "deviceUnbindSpace",
  "deviceTransfer",
  "nameUpdate",
  "deviceNameUpdate",
]);

const ONLINE_CODES = new Set(["online", "deviceOnline"]);
const OFFLINE_CODES = new Set(["offline", "deviceOffline"]);

function stringField(record: Record<string, unknown> | null, ...keys: string[]) {
  if (!record) return undefined;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value) return value;
  }
  return undefined;
}

export function parseTuyaDeviceEvent(payload: unknown): TuyaDeviceEvent | null {
  const envelope = asRecord(payload);
  const data = asRecord(envelope?.data) ?? asRecord(payload);
  if (!data) return null;

  const protocol = Number(envelope?.protocol ?? data.protocol ?? 0);
  const bizCode = stringField(data, "bizCode");
  const bizData = asRecord(data.bizData);
  const deviceId =
    stringField(data, "devId", "deviceId") || stringField(bizData, "devId", "deviceId") || "";
  if (!deviceId) return null;

  const properties = asStatusList(data.properties ?? bizData?.properties);
  const outputs = asStatusList(data.outputParams ?? bizData?.outputParams);
  const reported = asStatusList(data.status);
  let status = properties.length ? properties : reported.length ? reported : outputs;

  const eventCode = stringField(data, "eventCode") ?? stringField(bizData, "eventCode");
  if (eventCode && !status.some((item) => item.code === eventCode)) {
    status = [...status, { code: eventCode, value: outputs[0]?.value ?? true }];
  }

  const online = bizCode
    ? ONLINE_CODES.has(bizCode)
      ? true
      : OFFLINE_CODES.has(bizCode)
        ? false
        : undefined
    : undefined;

  return {
    deviceId,
    protocol,
    bizCode,
    online,
    status,
    inventoryChanged: Boolean(bizCode && INVENTORY_CODES.has(bizCode)),
  };
}

export class TuyaMessageClient extends EventEmitter<TuyaMessageEvents> {
  private socket: WebSocket | null = null;
  private retries = 0;
  private pingTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;

  constructor(
    private readonly options: {
      accessId: string;
      accessKey: string;
      region: TuyaMessageRegion;
      env: TuyaMessageEnv;
      timeoutMs?: number;
      maxRetries?: number;
    },
  ) {
    super();
  }

  start() {
    this.closed = false;
    this.connect();
  }

  stop() {
    this.closed = true;
    this.clearTimers();
    this.socket?.close();
    this.socket = null;
  }

  private connect() {
    if (this.closed) return;
    const url = topicUrl(this.options.region, this.options.accessId, this.options.env);
    const password = buildPassword(this.options.accessId, this.options.accessKey);
    const socket = new WebSocket(url, {
      headers: {
        username: this.options.accessId,
        password,
        Authorization: `Basic ${Buffer.from(`${this.options.accessId}:${password}`).toString("base64")}`,
      },
    });
    this.socket = socket;

    socket.on("open", () => {
      this.retries = 0;
      this.keepAlive();
      this.emit("open");
    });
    socket.on("message", (raw) => this.onMessage(raw));
    socket.on("ping", () => {
      this.keepAlive();
      socket.pong(this.options.accessId);
    });
    socket.on("pong", () => this.keepAlive());
    socket.on("error", (error) => this.emit("error", error));
    socket.on("close", (code, reason) => {
      this.clearPing();
      this.emit("close", code, reason.toString());
      this.scheduleReconnect();
    });
  }

  private onMessage(raw: WebSocket.RawData) {
    this.keepAlive();
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw.toString()) as Record<string, unknown>;
    } catch {
      this.emit("error", new Error("Mensagem Tuya inválida"));
      return;
    }

    const messageId = typeof parsed.messageId === "string" ? parsed.messageId : null;
    try {
      const event = this.decode(parsed);
      if (event) this.emit("event", event);
    } catch (error) {
      this.emit("error", error instanceof Error ? error : new Error("Falha a decifrar a mensagem Tuya"));
    }

    if (messageId && this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ messageId }));
    }
  }

  private decode(parsed: Record<string, unknown>): TuyaDeviceEvent | null {
    const payloadB64 = typeof parsed.payload === "string" ? parsed.payload : null;
    if (!payloadB64) return parseTuyaDeviceEvent(parsed);

    const inner = JSON.parse(Buffer.from(payloadB64, "base64").toString("utf8")) as Record<string, unknown>;
    const encrypted = typeof inner.data === "string" ? inner.data : null;
    if (!encrypted) return parseTuyaDeviceEvent(inner);

    const properties = asRecord(parsed.properties);
    const mode = typeof properties?.em === "string" ? properties.em : "";
    const data = mode === "aes_gcm" ? decryptGcm(encrypted, this.options.accessKey) : decryptEcb(encrypted, this.options.accessKey);
    return parseTuyaDeviceEvent({ ...inner, data });
  }

  private keepAlive() {
    this.clearPing();
    this.pingTimer = setTimeout(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.socket.ping(this.options.accessId);
      }
    }, this.options.timeoutMs ?? 30_000);
  }

  private scheduleReconnect() {
    if (this.closed) return;
    const maxRetries = this.options.maxRetries ?? 100;
    if (this.retries >= maxRetries) {
      this.emit("error", new Error("Tuya Message Service: esgotadas as tentativas de reconexão"));
      return;
    }
    this.retries += 1;
    this.reconnectTimer = setTimeout(() => this.connect(), Math.min(30_000, 1_000 * this.retries));
  }

  private clearPing() {
    if (this.pingTimer) clearTimeout(this.pingTimer);
    this.pingTimer = null;
  }

  private clearTimers() {
    this.clearPing();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }
}
