import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadCasaHouse } from "@/lib/casa";
import { CasaPulseView } from "@/components/casa-pulse";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  return {
    manifest: `/casa/${token}/manifest.webmanifest`,
  };
}

export default async function CasaPulsePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const house = await loadCasaHouse(token);
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
      token={token}
      houses={house.houses}
    />
  );
}
