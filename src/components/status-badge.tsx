import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Tone = "default" | "secondary" | "destructive" | "outline";

const statusTone: Record<string, Tone> = {
  NEW: "outline",
  CONTACTED: "outline",
  QUALIFIED: "secondary",
  PROPOSAL_SENT: "secondary",
  NEGOTIATING: "destructive",
  WON: "default",
  CONTRACT_SENT: "secondary",
  SIGNED: "default",
  LOST: "destructive",
  DRAFT: "outline",
  SENT: "secondary",
  VIEWED: "secondary",
  ACCEPTED: "default",
  REJECTED: "destructive",
  EXPIRED: "destructive",
  SUPERSEDED: "outline",
  PARTIALLY_SIGNED: "secondary",
  CANCELLED: "destructive",
  PUBLISHED: "default",
  SCHEDULED: "secondary",
  DONE: "default",
  OPEN: "destructive",
  ACKED: "secondary",
  RESOLVED: "outline",
  ACTIVE: "default",
  DISABLED: "outline",
  ok: "default",
  warn: "secondary",
  error: "destructive",
  idle: "outline",
};

const statusClass: Record<string, string> = {
  ok: "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  warn: "border-transparent bg-amber-500/15 text-amber-800 dark:text-amber-400",
  error: "border-transparent bg-red-500/15 text-red-700 dark:text-red-400",
};

export function StatusBadge({
  status,
  children,
  className,
}: {
  status: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Badge variant={statusTone[status] ?? "outline"} className={cn(statusClass[status], className)}>
      {children}
    </Badge>
  );
}
