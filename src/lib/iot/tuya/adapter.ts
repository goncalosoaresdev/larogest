import type { IoTAdapter, ProviderDevice, ProviderEvent, ProviderWatchHandlers } from "@/lib/iot/types";
import { getTuyaDevice, listTuyaHomeDevices, listTuyaHomes, tuyaCredentials } from "@/lib/iot/tuya/client";
import { resolveTuyaUids } from "@/lib/iot/tuya/uids";
import { checkTuyaHealth } from "@/lib/iot/tuya/health";
import { readingFromTuyaStatus, toProviderDevice } from "@/lib/iot/tuya/map";
import { TuyaMessageClient, tuyaRegionFromBaseUrl, type TuyaDeviceEvent } from "@/lib/iot/tuya/messages";

export const tuyaAdapter: IoTAdapter = {
  meta: {
    id: "TUYA",
    label: "Tuya",
    locationLabel: "Home ID",
    locationHint: "Na Smart Life, chama a casa pelo proprietário ou pela morada. Depois ligamos o Home ID.",
    deviceIdLabel: "Tuya device ID",
    pairingHint:
      "Emparelha o hub e os sensores na Smart Life. Depois sincroniza — a ficha enche com o que estiver nessa casa, e podes acrescentar mais mais tarde.",
  },

  describe() {
    const credentials = tuyaCredentials();
    return `Região ${tuyaRegionFromBaseUrl(credentials.baseUrl)} · canal ${credentials.messageEnv}`;
  },

  async listDevices(locationId: string): Promise<ProviderDevice[]> {
    const remote = await listTuyaHomeDevices(locationId);
    return remote.flatMap((device) => {
      const mapped = toProviderDevice(device);
      return mapped ? [{ ...mapped, locationId: mapped.locationId ?? locationId }] : [];
    });
  },

  async getDevice(deviceId: string): Promise<ProviderDevice | null> {
    const remote = await getTuyaDevice(deviceId);
    return remote ? toProviderDevice(remote) : null;
  },

  async listLocations() {
    const { uids } = await resolveTuyaUids();
    return listTuyaHomes(uids);
  },

  healthCheck(options) {
    return checkTuyaHealth(options);
  },

  watch(handlers: ProviderWatchHandlers) {
    const credentials = tuyaCredentials();
    const messages = new TuyaMessageClient({
      accessId: credentials.accessId,
      accessKey: credentials.accessSecret,
      region: tuyaRegionFromBaseUrl(credentials.baseUrl),
      env: credentials.messageEnv,
    });

    let live = false;
    messages.on("open", () => {
      live = true;
      handlers.onOpen?.();
    });
    messages.on("close", (code, reason) => {
      live = false;
      handlers.onClose?.(code, reason);
    });
    messages.on("error", (error) => handlers.onError?.(error));
    messages.on("event", (event) => handlers.onEvent(toProviderEvent(event)));

    const readyTimer = setTimeout(() => {
      if (!live) {
        handlers.onError?.(
          new Error(
            "Message Service ainda não ligou. Activa-o no projecto Tuya (Cloud → Message Service) e confirma TUYA_MESSAGE_ENV. Sem push, as fugas só aparecem na reconciliação.",
          ),
        );
      }
    }, 20_000);

    return {
      start() {
        messages.start();
      },
      stop() {
        clearTimeout(readyTimer);
        messages.stop();
      },
    };
  },
};

function toProviderEvent(event: TuyaDeviceEvent): ProviderEvent {
  const { reading, batteryPct } = readingFromTuyaStatus(event.status);
  return {
    deviceId: event.deviceId,
    online: event.online,
    reading,
    batteryPct,
    inventoryChanged: event.inventoryChanged,
    reason: event.bizCode,
  };
}
