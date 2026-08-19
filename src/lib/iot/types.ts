import type { IoTProvider, PulseDeviceKind } from "@prisma/client";
import type { PulseReading } from "@/lib/pulse";

export type IoTAdapterMeta = {
  id: IoTProvider;
  label: string;
  locationLabel: string;
  locationHint: string;
  deviceIdLabel: string;
  pairingHint: string;
};

export type ProviderLocation = {
  id: string;
  name: string;
  address?: string;
};

export type ProviderDevice = {
  id: string;
  name: string;
  model: string;
  kind: PulseDeviceKind;
  online: boolean;
  reading: PulseReading;
  batteryPct: number | null;
  locationId?: string;
};

export type ProviderEvent = {
  deviceId: string;
  online?: boolean;
  reading: PulseReading;
  batteryPct: number | null;
  inventoryChanged: boolean;
  reason?: string;
};

export type ProviderWatch = {
  start(): void;
  stop(): void;
};

export type ProviderWatchHandlers = {
  onEvent(event: ProviderEvent): void;
  onOpen?(): void;
  onClose?(code: number, reason: string): void;
  onError?(error: Error): void;
};

export type IntegrationStatus = "ok" | "warn" | "error" | "idle";

export type IntegrationCheck = {
  id: string;
  label: string;
  status: IntegrationStatus;
  detail: string;
};

export type IntegrationHealth = {
  id: IoTProvider;
  label: string;
  status: IntegrationStatus;
  checkedAt: string;
  cached: boolean;
  checks: IntegrationCheck[];
};

export type IoTAdapter = {
  readonly meta: IoTAdapterMeta;
  describe?(): string;
  listDevices(locationId: string): Promise<ProviderDevice[]>;
  getDevice?(deviceId: string): Promise<ProviderDevice | null>;
  listLocations?(): Promise<ProviderLocation[]>;
  healthCheck?(options?: { fresh?: boolean }): Promise<IntegrationHealth>;
  watch?(handlers: ProviderWatchHandlers): ProviderWatch;
};
