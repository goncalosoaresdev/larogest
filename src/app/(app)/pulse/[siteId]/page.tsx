import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { expectedLocationNames, getIoTAdapter, listIoTAdapters, matchProviderLocation } from "@/lib/iot";
import { sortPulseDevices } from "@/lib/pulse";
import { PulseDashboard } from "@/components/pulse-dashboard";

export default async function PulseSitePage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const site = await prisma.pulseSite.findUnique({
    where: { id: siteId },
    include: {
      property: { include: { person: true, leads: { orderBy: { createdAt: "desc" }, take: 1 } } },
      devices: true,
      alerts: { orderBy: { triggeredAt: "desc" }, take: 30 },
    },
  });
  if (!site || site.demo) notFound();

  const lead = site.property.leads[0];
  const adapter = getIoTAdapter(site.provider);
  const locations =
    !site.locationId && adapter.listLocations ? await adapter.listLocations().catch(() => []) : [];
  const taken = (
    await prisma.pulseSite.findMany({
      where: { id: { not: site.id }, locationId: { not: null } },
      select: { locationId: true },
    })
  ).flatMap((item) => (item.locationId ? [item.locationId] : []));
  const matchHints = {
    address: site.property.address,
    city: site.property.city,
    ownerName: site.property.person.name,
  };
  const suggested = site.locationId ? null : matchProviderLocation(locations, matchHints, taken);

  return (
    <PulseDashboard
      siteId={site.id}
      ownerName={site.property.person.name}
      address={[site.property.address, site.property.city].filter(Boolean).join(" · ")}
      provider={site.provider}
      locationId={site.locationId}
      locationName={site.locationName}
      providerMeta={adapter.meta}
      providers={listIoTAdapters().map((item) => item.meta)}
      locations={locations}
      suggestedLocation={suggested}
      locationHints={expectedLocationNames(matchHints)}
      leadHref={lead ? `/leads/${lead.id}` : null}
      ownerHref={`/casa/${site.id}`}
      devices={sortPulseDevices(site.devices)}
      alerts={site.alerts}
      siteStatus={site.status}
    />
  );
}
