import Link from "next/link";
import type { PulseAlert, PulseAlertType, PulseDevice, Property, Person } from "@prisma/client";
import { ackPulseAlert, resolvePulseAlert } from "@/app/(app)/pulse/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { formatRelativeTime } from "@/lib/format";
import { pulseAlertTypeLabel } from "@/lib/labels";
import {
  pulseAlertLane,
  pulseAlertUrgency,
  pulseAlertWork,
  pulseWorkLaneLabel,
  type PulseWorkLane,
} from "@/lib/pulse-alerts";
import { cn } from "@/lib/utils";

type AlertRow = PulseAlert & {
  site: {
    id: string;
    property: Pick<Property, "address" | "city"> & { person: Pick<Person, "name"> };
  };
  device: Pick<PulseDevice, "id" | "label" | "kind"> | null;
};

const laneOrder: PulseWorkLane[] = ["now", "watch", "seen"];

const laneTone: Record<PulseWorkLane, string> = {
  now: "bg-red-500",
  watch: "bg-amber-400",
  seen: "bg-muted-foreground/40",
};

export function PulseAlertBoard({
  alerts,
  filter,
}: {
  alerts: AlertRow[];
  filter: "all" | PulseWorkLane;
}) {
  const sorted = [...alerts].sort((left, right) => {
    const lane = laneRank(left) - laneRank(right);
    if (lane !== 0) return lane;
    const urgency = pulseAlertUrgency(left.type) - pulseAlertUrgency(right.type);
    if (urgency !== 0) return urgency;
    return right.triggeredAt.getTime() - left.triggeredAt.getTime();
  });

  const counts = {
    all: sorted.length,
    now: sorted.filter((alert) => pulseAlertLane(alert.type, alert.status) === "now").length,
    watch: sorted.filter((alert) => pulseAlertLane(alert.type, alert.status) === "watch").length,
    seen: sorted.filter((alert) => pulseAlertLane(alert.type, alert.status) === "seen").length,
  };

  const visible = filter === "all" ? sorted : sorted.filter((alert) => pulseAlertLane(alert.type, alert.status) === filter);
  const headline = boardHeadline(counts);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alertas"
        description={
          counts.all === 0
            ? "Quando um sensor disparar, aparece aqui com o que fazer e a casa certa."
            : "Trata primeiro as fugas. Visto deixa no radar; resolver tira da lista."
        }
      />

      {counts.now > 0 ? <p className="text-sm text-destructive">{headline}</p> : null}

      <nav className="flex flex-wrap gap-2" aria-label="Filtrar alertas">
        <FilterChip href="/pulse/alertas" active={filter === "all"} count={counts.all}>
          Tudo
        </FilterChip>
        <FilterChip href="/pulse/alertas?f=now" active={filter === "now"} count={counts.now} tone="now">
          Ir agora
        </FilterChip>
        <FilterChip href="/pulse/alertas?f=watch" active={filter === "watch"} count={counts.watch} tone="watch">
          Atenção
        </FilterChip>
        <FilterChip href="/pulse/alertas?f=seen" active={filter === "seen"} count={counts.seen} tone="seen">
          Já visto
        </FilterChip>
      </nav>

      {visible.length === 0 ? (
        <Card>
          <p className="p-6 text-sm text-muted-foreground">
            {filter === "all" ? "Nada em aberto neste momento." : "Nada nesta lista."}
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {laneOrder
            .filter((lane) => (filter === "all" ? true : filter === lane))
            .map((lane) => {
              const items = visible.filter((alert) => pulseAlertLane(alert.type, alert.status) === lane);
              if (items.length === 0) return null;
              return (
                <section key={lane} className="space-y-3">
                  {filter === "all" ? (
                    <h2 className="text-sm font-medium">{pulseWorkLaneLabel[lane]}</h2>
                  ) : null}
                  <Card className="py-0">
                    <ul className="divide-y">
                      {items.map((alert) => (
                        <AlertWorkRow key={alert.id} alert={alert} lane={lane} />
                      ))}
                    </ul>
                  </Card>
                </section>
              );
            })}
        </div>
      )}
    </div>
  );
}

function AlertWorkRow({ alert, lane }: { alert: AlertRow; lane: PulseWorkLane }) {
  const work = pulseAlertWork(alert.type);
  const address = [alert.site.property.address, alert.site.property.city].filter(Boolean).join(" · ");
  const ack = ackPulseAlert.bind(null, alert.id);
  const resolve = resolvePulseAlert.bind(null, alert.id);

  return (
    <li className="flex gap-0">
      <span className={cn("w-1 shrink-0", laneTone[lane])} aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium">
            {work.verb}
            <span className="font-normal text-muted-foreground"> · {work.why}</span>
          </p>
          <p className="truncate text-sm text-muted-foreground">
            {alert.site.property.person.name} · {address}
          </p>
          <p className="font-mono text-[11px] text-muted-foreground">
            {alert.device?.label ?? pulseAlertTypeLabel[alert.type]}
            {" · "}
            {formatRelativeTime(alert.triggeredAt) ?? "agora"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {alert.status === "OPEN" ? (
            <form action={ack}>
              <Button type="submit" size="sm" variant="outline">
                Visto
              </Button>
            </form>
          ) : null}
          <form action={resolve}>
            <Button type="submit" size="sm" variant={lane === "now" ? "default" : "ghost"}>
              Resolver
            </Button>
          </form>
          <Link
            href={`/pulse/${alert.site.id}`}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Casa
          </Link>
        </div>
      </div>
    </li>
  );
}

function FilterChip({
  href,
  active,
  count,
  tone,
  children,
}: {
  href: string;
  active: boolean;
  count: number;
  tone?: PulseWorkLane;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition-colors",
        active ? "border-foreground/30 bg-foreground/10 text-foreground" : "border-border/70 text-muted-foreground hover:text-foreground",
      )}
    >
      {tone ? <span className={cn("size-1.5 rounded-full", laneTone[tone])} /> : null}
      {children}
      <span className="font-mono tabular-nums">{count}</span>
    </Link>
  );
}

function boardHeadline(counts: { all: number; now: number; watch: number }) {
  if (counts.now === 1) return "1 fuga a tratar";
  if (counts.now > 1) return `${counts.now} fugas a tratar`;
  if (counts.watch === 1) return "1 coisa em atenção";
  if (counts.watch > 1) return `${counts.watch} coisas em atenção`;
  if (counts.all > 0) return "Só o que já viste";
  return "Tudo tratado";
}

function laneRank(alert: { type: PulseAlertType; status: string }) {
  const lane = pulseAlertLane(alert.type, alert.status);
  return lane === "now" ? 0 : lane === "watch" ? 1 : 2;
}
