import type { IntegrationCheck, IntegrationHealth, IntegrationStatus } from "@/lib/iot/types";
import { peekTuyaHomesCache, pingTuyaApi, tuyaCredentials } from "@/lib/iot/tuya/client";
import { resolveTuyaUids } from "@/lib/iot/tuya/uids";
import { tuyaRegionFromBaseUrl } from "@/lib/iot/tuya/messages";

const HEALTH_TTL_MS = 5 * 60_000;
const MIN_REFRESH_MS = 30_000;
let healthCache: { at: number; value: IntegrationHealth } | null = null;

export async function checkTuyaHealth(options?: { fresh?: boolean }): Promise<IntegrationHealth> {
  const now = Date.now();
  if (healthCache && now - healthCache.at < (options?.fresh ? MIN_REFRESH_MS : HEALTH_TTL_MS)) {
    return { ...healthCache.value, cached: true };
  }

  const value = await probeTuyaHealth();
  healthCache = { at: now, value };
  return value;
}

async function probeTuyaHealth(): Promise<IntegrationHealth> {
  const checks: IntegrationCheck[] = [];
  let credentials: ReturnType<typeof tuyaCredentials> | null = null;

  try {
    credentials = tuyaCredentials();
    checks.push({
      id: "credentials",
      label: "Credenciais",
      status: "ok",
      detail: `Região ${tuyaRegionFromBaseUrl(credentials.baseUrl)} · canal ${credentials.messageEnv}`,
    });
  } catch (error) {
    checks.push({
      id: "credentials",
      label: "Credenciais",
      status: "error",
      detail: error instanceof Error ? error.message : "Faltam as chaves Tuya no .env",
    });
  }

  if (credentials) {
    const account = await resolveTuyaUids();
    const cachedHomes = peekTuyaHomesCache()?.value.length;
    checks.push({
      id: "account",
      label: "Casas Smart Life",
      status: "ok",
      detail:
        account.source === "env"
          ? `Lista pelo UID da conta (${account.uids.length})`
          : account.source === "device"
            ? `Lista pelo UID de um dispositivo já ligado`
            : cachedHomes
              ? `${cachedHomes} casa${cachedHomes === 1 ? "" : "s"} via dispositivos do projecto — UID não é preciso`
              : "Access ID chega. As casas com sensores listam-se pelo projecto; UID só ajudaria casas ainda vazias.",
    });

    try {
      const ping = await pingTuyaApi();
      const homes = ping.homes ?? peekTuyaHomesCache()?.value.length;
      checks.push({
        id: "api",
        label: "OpenAPI",
        status: "ok",
        detail: ping.cached
          ? homes != null
            ? `OK (cache) · ${homes} casa${homes === 1 ? "" : "s"}`
            : "OK — último contacto recente, sem nova chamada"
          : "Token válido",
      });
    } catch (error) {
      checks.push({
        id: "api",
        label: "OpenAPI",
        status: "error",
        detail: error instanceof Error ? error.message : "Falha a contactar a Tuya",
      });
    }
  }

  return {
    id: "TUYA",
    label: "Tuya",
    status: worstStatus(checks),
    checkedAt: new Date().toISOString(),
    cached: false,
    checks,
  };
}

function worstStatus(checks: IntegrationCheck[]): IntegrationStatus {
  if (checks.some((check) => check.status === "error")) return "error";
  if (checks.some((check) => check.status === "warn")) return "warn";
  if (checks.length === 0) return "idle";
  return "ok";
}
