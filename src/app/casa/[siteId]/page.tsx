import { notFound, redirect } from "next/navigation";
import { CasaPulseView } from "@/components/casa-pulse";
import { canAccessCasaSite, loadCasaHouse } from "@/lib/casa";
import { prisma } from "@/lib/prisma";
import { isPulseSiteActive } from "@/lib/pulse";
import { getSession, getSessionRole } from "@/lib/session";

export default async function CasaPulsePage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const session = await getSession();
  if (!session) redirect(`/casa/entrar?next=${encodeURIComponent(`/casa/${siteId}`)}`);

  const site = await prisma.pulseSite.findUnique({
    where: { id: siteId },
    select: {
      id: true,
      status: true,
      property: { select: { person: { select: { userId: true, email: true } } } },
    },
  });
  if (!site) {
    const legacy = await prisma.pulseSite.findUnique({
      where: { publicToken: siteId },
      select: {
        id: true,
        status: true,
        property: { select: { person: { select: { userId: true, email: true } } } },
      },
    });
    if (
      legacy &&
      isPulseSiteActive(legacy.status) &&
      canAccessCasaSite(session, legacy)
    ) {
      redirect(`/casa/${legacy.id}`);
    }
    notFound();
  }
  if (!isPulseSiteActive(site.status) || !canAccessCasaSite(session, site)) notFound();

  const house = await loadCasaHouse(site.id);
  if (!house) notFound();

  return (
    <CasaPulseView
      ownerName={house.ownerName}
      address={house.address}
      city={house.city}
      devices={house.devices}
      alerts={house.alerts}
      samples={house.samples}
      now={house.now.toISOString()}
      siteId={site.id}
      houses={house.houses}
      canSignOut={getSessionRole(session) === "OWNER"}
    />
  );
}
