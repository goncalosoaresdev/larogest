import { prisma } from "@/lib/prisma";
import { LiveRefresh } from "@/components/live-refresh";
import { PulseAlertBoard } from "@/components/pulse-alert-board";
import { PULSE_SITE_DISABLED } from "@/lib/pulse";
import type { PulseWorkLane } from "@/lib/pulse-alerts";

export default async function PulseAlertasPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string }>;
}) {
  const { f } = await searchParams;
  const filter = f === "now" || f === "watch" || f === "seen" ? (f as PulseWorkLane) : "all";

  const alerts = await prisma.pulseAlert.findMany({
    where: {
      status: { in: ["OPEN", "ACKED"] },
      site: { status: { not: PULSE_SITE_DISABLED }, demo: false },
    },
    include: {
      site: { include: { property: { include: { person: true } } } },
      device: { select: { id: true, label: true, kind: true } },
    },
    orderBy: { triggeredAt: "desc" },
  });

  return (
    <>
      <LiveRefresh />
      <PulseAlertBoard alerts={alerts} filter={filter} />
    </>
  );
}
