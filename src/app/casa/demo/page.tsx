import { CasaPulseView } from "@/components/casa-pulse";
import { refreshDemoCasa, CASA_DEMO } from "@/lib/casa-demo";
import { loadCasaHouse } from "@/lib/casa";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

export default async function CasaDemoPage() {
  const ready = await refreshDemoCasa(prisma);
  if (!ready) notFound();
  const house = await loadCasaHouse(CASA_DEMO.siteId);
  if (!house) notFound();

  return (
    <CasaPulseView
      demo
      ownerName={house.ownerName}
      address={house.address}
      city={house.city}
      devices={house.devices}
      alerts={house.alerts}
      samples={house.samples}
      now={house.now.toISOString()}
      siteId="demo"
      houses={[]}
      canSignOut={false}
    />
  );
}
