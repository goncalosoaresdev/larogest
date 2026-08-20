"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { logActivity } from "@/lib/audit";
import {
  applyPulseReading,
  autoLinkPulseSite,
  createEmptyPulseSite,
  isPulseSiteActive,
  resolveLocationName,
  PULSE_SITE_ACTIVE,
  PULSE_SITE_DISABLED,
  syncPulseDevices,
} from "@/lib/pulse";
import { getIoTAdapter, parseIoTProvider } from "@/lib/iot";
import { notifyOpenedPulseAlerts } from "@/lib/pulse-notify";
import { pulseLocationSchema, pulseReadingSchema, pulseSiteSchema } from "@/lib/validations";
import { isStaffEmail, normalizeOwnerEmail } from "@/lib/owner-auth";

function emptyToNull(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length ? text : null;
}

function parseOptionalNumber(value: string | undefined) {
  const text = value?.trim() ?? "";
  if (!text) return null;
  const amount = Number(text.replace(",", "."));
  return Number.isFinite(amount) ? amount : null;
}

async function activateOnProperty(propertyId: string, actorId: string, leadId?: string | null) {
  const existing = await prisma.pulseSite.findUnique({ where: { propertyId } });
  if (existing) {
    if (isPulseSiteActive(existing.status)) return existing;
    const updated = await prisma.pulseSite.update({
      where: { id: existing.id },
      data: { status: PULSE_SITE_ACTIVE },
    });
    if (!updated.locationId) await tryAutoLinkSite(updated.id);
    return updated;
  }

  const site = await prisma.$transaction((tx) => createEmptyPulseSite(tx, propertyId));
  await logActivity({
    leadId: leadId ?? null,
    entityType: "pulse",
    entityId: site.id,
    action: "pulse_activated",
    actorId,
    payload: { propertyId },
  });
  await tryAutoLinkSite(site.id);
  return site;
}

export async function createPulseSite(formData: FormData): Promise<void> {
  const session = await requireSession();
  const parsed = pulseSiteSchema.safeParse({
    ownerName: formData.get("ownerName"),
    email: formData.get("email"),
    address: formData.get("address"),
    city: formData.get("city") || undefined,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos");
  }
  if (await isStaffEmail(parsed.data.email)) {
    throw new Error("Este email pertence à equipa Laro. Usa o email do proprietário.");
  }

  const person = await prisma.person.create({
    data: {
      name: parsed.data.ownerName,
      email: normalizeOwnerEmail(parsed.data.email),
      type: "INDIVIDUAL",
    },
  });
  const property = await prisma.property.create({
    data: {
      personId: person.id,
      address: parsed.data.address,
      city: emptyToNull(parsed.data.city ?? null),
      typology: "HOUSE",
    },
  });
  const site = await activateOnProperty(property.id, session.user.id);
  revalidatePath("/pulse");
  redirect(`/pulse/${site.id}`);
}

export async function activatePulseOnProperty(formData: FormData): Promise<void> {
  const session = await requireSession();
  const propertyId = String(formData.get("propertyId") ?? "");
  if (!propertyId) throw new Error("Escolhe um imóvel");

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    include: { person: true, leads: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!property) throw new Error("Imóvel não encontrado");
  if (!property.person.email?.trim()) {
    throw new Error("Adiciona o email do proprietário no imóvel antes de activar o Pulse.");
  }
  if (await isStaffEmail(property.person.email)) {
    throw new Error("Este email pertence à equipa Laro. Usa o email do proprietário.");
  }

  const site = await activateOnProperty(property.id, session.user.id, property.leads[0]?.id);
  revalidatePath("/pulse");
  revalidatePath(`/leads`);
  redirect(`/pulse/${site.id}`);
}

export async function activatePulseOnLead(leadId: string): Promise<void> {
  const session = await requireSession();
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { property: { include: { person: true } } },
  });
  if (!lead?.propertyId || !lead.property) throw new Error("Esta lead ainda não tem imóvel");
  if (!lead.property.person.email?.trim()) {
    throw new Error("Adiciona o email do proprietário no imóvel antes de activar o Pulse.");
  }
  if (await isStaffEmail(lead.property.person.email)) {
    throw new Error("Este email pertence à equipa Laro. Usa o email do proprietário.");
  }

  const site = await activateOnProperty(lead.propertyId, session.user.id, lead.id);
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/pulse");
  redirect(`/pulse/${site.id}`);
}

export async function savePulseDeviceLink(deviceId: string, formData: FormData): Promise<void> {
  await requireSession();
  const device = await prisma.pulseDevice.findUnique({ where: { id: deviceId } });
  if (!device) throw new Error("Dispositivo não encontrado");

  await prisma.pulseDevice.update({
    where: { id: deviceId },
    data: { providerDeviceId: emptyToNull(formData.get("providerDeviceId")) },
  });
  revalidatePath(`/pulse/${device.siteId}`);
}

export async function savePulseLocation(siteId: string, formData: FormData): Promise<void> {
  await requireSession();
  const parsed = pulseLocationSchema.safeParse({
    provider: parseIoTProvider(formData.get("provider")),
    locationId: String(formData.get("locationId") ?? ""),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos");
  }

  const locationId = emptyToNull(parsed.data.locationId ?? null);
  const locationName = locationId ? await resolveLocationName(parsed.data.provider, locationId) : null;
  const site = await prisma.pulseSite.update({
    where: { id: siteId },
    data: { provider: parsed.data.provider, locationId, locationName },
  });
  if (locationId && isPulseSiteActive(site.status)) {
    await importProviderDevices(siteId);
  }
  revalidatePath(`/pulse/${siteId}`);
  revalidatePath("/pulse");
}

export async function syncPulseLocation(siteId: string): Promise<void> {
  await requireSession();
  await importProviderDevices(siteId);
  revalidatePath(`/pulse/${siteId}`);
  revalidatePath("/pulse");
}

export async function linkPulseLocationByName(siteId: string): Promise<void> {
  await requireSession();
  const match = await autoLinkPulseSite(siteId);
  if (!match) {
    throw new Error(
      "Não encontrámos uma casa na Smart Life com o nome do proprietário ou da morada. Confirma o nome na app ou escolhe a casa na lista.",
    );
  }
  await importProviderDevices(siteId);
  revalidatePath(`/pulse/${siteId}`);
  revalidatePath("/pulse");
}

async function tryAutoLinkSite(siteId: string) {
  try {
    const match = await autoLinkPulseSite(siteId);
    if (match) await importProviderDevices(siteId);
  } catch {
    // Linking is best-effort on activate; the house page can retry.
  }
}

export async function disablePulseSite(siteId: string): Promise<void> {
  const session = await requireSession();
  const site = await prisma.pulseSite.findUnique({ where: { id: siteId } });
  if (!site) throw new Error("Pulse não encontrado");

  await prisma.pulseSite.update({
    where: { id: siteId },
    data: { status: PULSE_SITE_DISABLED },
  });
  await logActivity({
    entityType: "pulse",
    entityId: siteId,
    action: "pulse_disabled",
    actorId: session.user.id,
    payload: { propertyId: site.propertyId },
  });
  revalidatePath(`/pulse/${siteId}`);
  revalidatePath("/pulse");
}

export async function enablePulseSite(siteId: string): Promise<void> {
  const session = await requireSession();
  const site = await prisma.pulseSite.findUnique({ where: { id: siteId } });
  if (!site) throw new Error("Pulse não encontrado");

  await prisma.pulseSite.update({
    where: { id: siteId },
    data: { status: PULSE_SITE_ACTIVE },
  });
  if (!site.locationId) await tryAutoLinkSite(siteId);
  await logActivity({
    entityType: "pulse",
    entityId: siteId,
    action: "pulse_enabled",
    actorId: session.user.id,
    payload: { propertyId: site.propertyId },
  });
  revalidatePath(`/pulse/${siteId}`);
  revalidatePath("/pulse");
}

export async function deletePulseSite(siteId: string): Promise<void> {
  const session = await requireSession();
  const site = await prisma.pulseSite.findUnique({ where: { id: siteId } });
  if (!site) throw new Error("Pulse não encontrado");

  await prisma.pulseSite.delete({ where: { id: siteId } });
  await logActivity({
    entityType: "pulse",
    entityId: siteId,
    action: "pulse_deleted",
    actorId: session.user.id,
    payload: { propertyId: site.propertyId },
  });
  revalidatePath("/pulse");
  redirect("/pulse");
}

async function importProviderDevices(siteId: string) {
  const site = await prisma.pulseSite.findUnique({ where: { id: siteId } });
  if (!site) throw new Error("Pulse não encontrado");
  if (!isPulseSiteActive(site.status)) {
    throw new Error("Esta casa Pulse está desactivada.");
  }
  const adapter = getIoTAdapter(site.provider);
  if (!site.locationId) {
    throw new Error(`Guarda o ${adapter.meta.locationLabel} primeiro.`);
  }
  const remote = await adapter.listDevices(site.locationId);
  await prisma.$transaction((tx) => syncPulseDevices(tx, site.id, remote));
  if (!site.locationName) {
    const locationName = await resolveLocationName(site.provider, site.locationId);
    if (locationName) {
      await prisma.pulseSite.update({ where: { id: site.id }, data: { locationName } });
    }
  }
}

export async function recordPulseReading(formData: FormData): Promise<void> {
  await requireSession();
  const parsed = pulseReadingSchema.safeParse({
    deviceId: formData.get("deviceId"),
    online: formData.get("online") || undefined,
    batteryPct: formData.get("batteryPct") || undefined,
    open: formData.get("open") || undefined,
    leak: formData.get("leak") || undefined,
    motion: formData.get("motion") || undefined,
    temperature: formData.get("temperature") || undefined,
    humidity: formData.get("humidity") || undefined,
    lux: formData.get("lux") || undefined,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Leitura inválida");
  }

  const device = await prisma.pulseDevice.findUnique({ where: { id: parsed.data.deviceId } });
  if (!device) throw new Error("Dispositivo não encontrado");

  const batteryPct = parseOptionalNumber(parsed.data.batteryPct);
  const opened = await prisma.$transaction((tx) =>
    applyPulseReading(tx, device, {
      online: parsed.data.online !== "false",
      batteryPct: batteryPct != null ? Math.round(batteryPct) : device.batteryPct,
      reading: {
        open: parsed.data.open != null ? parsed.data.open === "true" : undefined,
        leak: parsed.data.leak != null ? parsed.data.leak === "true" : undefined,
        motion: parsed.data.motion != null ? parsed.data.motion === "true" : undefined,
        temperature: parseOptionalNumber(parsed.data.temperature) ?? undefined,
        humidity: parseOptionalNumber(parsed.data.humidity) ?? undefined,
        lux: parseOptionalNumber(parsed.data.lux) ?? undefined,
      },
    }),
  );
  if (opened.length) {
    void notifyOpenedPulseAlerts(device.siteId, device.label, opened).catch(() => undefined);
  }

  revalidatePath(`/pulse/${device.siteId}`);
  revalidatePath("/pulse");
  revalidatePath("/pulse/alertas");
}

export async function ackPulseAlert(alertId: string): Promise<void> {
  await requireSession();
  const alert = await prisma.pulseAlert.findUnique({ where: { id: alertId } });
  if (!alert) throw new Error("Alerta não encontrado");
  if (alert.status !== "OPEN") return;

  await prisma.pulseAlert.update({
    where: { id: alertId },
    data: { status: "ACKED" },
  });
  revalidatePath(`/pulse/${alert.siteId}`);
  revalidatePath("/pulse");
  revalidatePath("/pulse/alertas");
}

export async function resolvePulseAlert(alertId: string): Promise<void> {
  await requireSession();
  const alert = await prisma.pulseAlert.findUnique({ where: { id: alertId } });
  if (!alert) throw new Error("Alerta não encontrado");

  await prisma.pulseAlert.update({
    where: { id: alertId },
    data: { status: "RESOLVED", resolvedAt: new Date() },
  });
  revalidatePath(`/pulse/${alert.siteId}`);
  revalidatePath("/pulse");
  revalidatePath("/pulse/alertas");
}
