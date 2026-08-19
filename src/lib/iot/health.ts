import { prisma } from "@/lib/prisma";
import { listIoTAdapters } from "@/lib/iot";
import { PULSE_SITE_DISABLED } from "@/lib/pulse";
import type { IntegrationHealth, IntegrationStatus } from "@/lib/iot/types";

export type IntegrationReport = IntegrationHealth & {
  pulse: {
    linkedHomes: number;
    devices: number;
    lastSeenAt: string | null;
    activityStatus: IntegrationStatus;
    activityDetail: string;
  };
};

export async function getIntegrationReports(options?: { fresh?: boolean }): Promise<IntegrationReport[]> {
  const pulse = await pulseActivity();
  const adapters = listIoTAdapters();

  return Promise.all(
    adapters.map(async (adapter) => {
      const health = adapter.healthCheck
        ? await adapter.healthCheck(options)
        : {
            id: adapter.meta.id,
            label: adapter.meta.label,
            status: "idle" as const,
            checkedAt: new Date().toISOString(),
            cached: false,
            checks: [
              {
                id: "probe",
                label: "Sonda",
                status: "idle" as const,
                detail: "Este adaptador ainda não expõe um health check.",
              },
            ],
          };

      return { ...health, pulse };
    }),
  );
}

async function pulseActivity() {
  const [linkedHomes, devices, last] = await Promise.all([
    prisma.pulseSite.count({
      where: { locationId: { not: null }, status: { not: PULSE_SITE_DISABLED } },
    }),
    prisma.pulseDevice.count({
      where: { site: { status: { not: PULSE_SITE_DISABLED } } },
    }),
    prisma.pulseDevice.findFirst({
      where: { lastSeenAt: { not: null }, site: { status: { not: PULSE_SITE_DISABLED } } },
      orderBy: { lastSeenAt: "desc" },
      select: { lastSeenAt: true, label: true },
    }),
  ]);

  const lastSeenAt = last?.lastSeenAt?.toISOString() ?? null;
  const ageMs = last?.lastSeenAt ? Date.now() - last.lastSeenAt.getTime() : null;
  const activityStatus: IntegrationStatus =
    linkedHomes === 0 ? "idle" : ageMs == null ? "warn" : ageMs > 2 * 60 * 60_000 ? "warn" : "ok";
  const activityDetail =
    linkedHomes === 0
      ? "Nenhuma casa Pulse ligada"
      : lastSeenAt
        ? `${linkedHomes} casa${linkedHomes === 1 ? "" : "s"} · ${devices} sensor${devices === 1 ? "" : "es"} · última leitura ${last?.label ?? ""}`
        : `${linkedHomes} casa${linkedHomes === 1 ? "" : "s"} ligadas, ainda sem leituras`;

  return {
    linkedHomes,
    devices,
    lastSeenAt,
    activityStatus,
    activityDetail: activityDetail.trim(),
  };
}


