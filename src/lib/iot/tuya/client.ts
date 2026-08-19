import { TuyaContext } from "@tuya/tuya-connector-nodejs";
import type { TuyaMessageEnv } from "@/lib/iot/tuya/messages";
import type { TuyaHomeDevice } from "@/lib/iot/tuya/map";
import type { ProviderLocation } from "@/lib/iot/types";

export function tuyaCredentials() {
  const accessId = process.env.TUYA_ACCESS_ID?.trim();
  const accessSecret = process.env.TUYA_ACCESS_SECRET?.trim();
  if (!accessId || !accessSecret) {
    throw new Error("Faltam TUYA_ACCESS_ID e TUYA_ACCESS_SECRET no .env");
  }
  return {
    accessId,
    accessSecret,
    baseUrl: process.env.TUYA_BASE_URL?.trim() || "https://openapi.tuyaeu.com",
    messageEnv: (process.env.TUYA_MESSAGE_ENV?.trim() === "test" ? "test" : "prod") as TuyaMessageEnv,
    uids: (process.env.TUYA_UID ?? "")
      .split(/[,\s]+/)
      .map((uid) => uid.trim())
      .filter(Boolean),
  };
}

let tuyaClient: TuyaContext | null = null;

export function createTuyaClient() {
  if (tuyaClient) return tuyaClient;
  const { accessId, accessSecret, baseUrl } = tuyaCredentials();
  tuyaClient = new TuyaContext({
    baseUrl,
    accessKey: accessId,
    secretKey: accessSecret,
  });
  return tuyaClient;
}

export async function listTuyaHomeDevices(homeId: string): Promise<TuyaHomeDevice[]> {
  const tuya = createTuyaClient();
  const response = await tuya.request<TuyaHomeDevice[] | { devices?: TuyaHomeDevice[] }>({
    path: `/v1.0/homes/${homeId}/devices`,
    method: "GET",
  });

  if (!response.success) {
    throw new Error(response.msg?.trim() || "A Tuya não devolveu os dispositivos desta casa.");
  }

  markTuyaApiOk();
  if (Array.isArray(response.result)) return response.result.filter((device) => device.id);
  return (response.result?.devices ?? []).filter((device) => device.id);
}

type TuyaHomeRow = {
  home_id?: number | string;
  name?: string;
  geo_name?: string;
};

function asHome(row: TuyaHomeRow): ProviderLocation | null {
  const id = row.home_id != null ? String(row.home_id) : "";
  if (!id) return null;
  return {
    id,
    name: row.name?.trim() || id,
    address: row.geo_name?.trim() || undefined,
  };
}

const HOMES_TTL_MS = 2 * 60_000;
const API_OK_TTL_MS = 5 * 60_000;
let homesCache: { at: number; value: ProviderLocation[] } | null = null;
let lastApiOkAt: number | null = null;

function markTuyaApiOk() {
  lastApiOkAt = Date.now();
}

export function peekTuyaApiOk() {
  if (lastApiOkAt && Date.now() - lastApiOkAt < API_OK_TTL_MS) return lastApiOkAt;
  return null;
}

export function peekTuyaHomesCache() {
  if (homesCache && Date.now() - homesCache.at < HOMES_TTL_MS) return homesCache;
  return null;
}

export async function pingTuyaApi() {
  const homes = peekTuyaHomesCache();
  if (homes) {
    return { ok: true as const, cached: true, homes: homes.value.length };
  }
  if (peekTuyaApiOk()) {
    return { ok: true as const, cached: true, homes: null };
  }

  const tuya = createTuyaClient();
  const token = await tuya.client.init();
  if (!token.success) {
    throw new Error(token.msg?.trim() || "A Tuya não emitiu um token.");
  }
  markTuyaApiOk();
  return { ok: true as const, cached: false, homes: null };
}

export async function listTuyaHomes(uids?: string[]): Promise<ProviderLocation[]> {
  if (homesCache && Date.now() - homesCache.at < HOMES_TTL_MS) return homesCache.value;
  const value = await fetchTuyaHomes(uids ?? tuyaCredentials().uids);
  homesCache = { at: Date.now(), value };
  return value;
}

async function fetchTuyaHomes(uids: string[]): Promise<ProviderLocation[]> {
  const tuya = createTuyaClient();
  const homes = new Map<string, ProviderLocation>();

  for (const uid of uids) {
    const response = await tuya.request<TuyaHomeRow[]>({
      path: `/v1.0/users/${uid}/homes`,
      method: "GET",
    });
    if (!response.success) {
      throw new Error(response.msg?.trim() || "A Tuya não devolveu as casas desta conta.");
    }
    for (const row of response.result ?? []) {
      const home = asHome(row);
      if (home) homes.set(home.id, home);
    }
  }

  if (homes.size === 0) {
    const response = await tuya.request<{ devices?: Array<{ owner_id?: string }> }>({
      path: "/v1.0/devices",
      method: "GET",
      query: { page_no: 1, page_size: 100 },
    });
    const ownerIds = [
      ...new Set((response.result?.devices ?? []).map((device) => device.owner_id).filter(Boolean)),
    ] as string[];
    for (const homeId of ownerIds) {
      const detail = await tuya.request<TuyaHomeRow>({
        path: `/v1.0/homes/${homeId}`,
        method: "GET",
      });
      const home = detail.success ? asHome(detail.result ?? {}) : null;
      homes.set(homeId, home ?? { id: homeId, name: homeId });
    }
  }

  markTuyaApiOk();
  return [...homes.values()].sort((left, right) => left.name.localeCompare(right.name, "pt"));
}

export async function getTuyaDevice(deviceId: string): Promise<TuyaHomeDevice | null> {
  const tuya = createTuyaClient();
  const response = await tuya.request<TuyaHomeDevice>({
    path: `/v1.0/devices/${deviceId}`,
    method: "GET",
  });
  if (!response.success || !response.result?.id) return null;
  markTuyaApiOk();
  return response.result;
}
