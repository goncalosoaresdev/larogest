import { prisma } from "@/lib/prisma";
import { getTuyaDevice, tuyaCredentials } from "@/lib/iot/tuya/client";

let discovered: string[] | null = null;

export async function resolveTuyaUids(): Promise<{ uids: string[]; source: "env" | "device" | "none" }> {
  const fromEnv = tuyaCredentials().uids;
  if (fromEnv.length) return { uids: fromEnv, source: "env" };
  if (discovered?.length) return { uids: discovered, source: "device" };

  const device = await prisma.pulseDevice.findFirst({
    where: { providerDeviceId: { not: null } },
    select: { providerDeviceId: true },
  });
  if (!device?.providerDeviceId) return { uids: [], source: "none" };

  const remote = await getTuyaDevice(device.providerDeviceId);
  const uid = remote?.uid?.trim();
  if (!uid) return { uids: [], source: "none" };

  discovered = [uid];
  return { uids: discovered, source: "device" };
}
