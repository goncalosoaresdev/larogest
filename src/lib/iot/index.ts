import { IoTProvider } from "@prisma/client";
import { tuyaAdapter } from "@/lib/iot/tuya/adapter";
import type { IoTAdapter } from "@/lib/iot/types";

export type {
  IoTAdapter,
  IoTAdapterMeta,
  ProviderDevice,
  ProviderEvent,
  ProviderLocation,
  ProviderWatch,
} from "@/lib/iot/types";
export { expectedLocationNames, matchProviderLocation } from "@/lib/iot/match";
export { getIntegrationReports, type IntegrationReport } from "@/lib/iot/health";

// Add a provider: implement IoTAdapter, register it here, add the Prisma enum value.
const adapters: Record<IoTProvider, IoTAdapter> = {
  TUYA: tuyaAdapter,
};

export function getIoTAdapter(id: IoTProvider): IoTAdapter {
  const adapter = adapters[id];
  if (!adapter) {
    throw new Error(`Fornecedor IoT sem adaptador: ${id}`);
  }
  return adapter;
}

export function listIoTAdapters(): IoTAdapter[] {
  return Object.values(adapters);
}

export function parseIoTProvider(value: unknown): IoTProvider {
  const id = String(value ?? "").trim();
  if (id in adapters) return id as IoTProvider;
  return IoTProvider.TUYA;
}
