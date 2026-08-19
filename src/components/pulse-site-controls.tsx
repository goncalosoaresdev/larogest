"use client";

import { disablePulseSite, deletePulseSite, enablePulseSite } from "@/app/(app)/pulse/actions";
import { isPulseSiteActive } from "@/lib/pulse";
import { Button } from "@/components/ui/button";

export function PulseSiteControls({
  siteId,
  status,
  compact = false,
}: {
  siteId: string;
  status: string;
  compact?: boolean;
}) {
  const active = isPulseSiteActive(status);
  const disable = disablePulseSite.bind(null, siteId);
  const enable = enablePulseSite.bind(null, siteId);
  const remove = deletePulseSite.bind(null, siteId);

  return (
    <div className={compact ? "flex items-center justify-end gap-1" : "flex flex-wrap items-center gap-2"}>
      {active ? (
        <form action={disable}>
          <Button type="submit" size="sm" variant="ghost">
            Desactivar
          </Button>
        </form>
      ) : (
        <form action={enable}>
          <Button type="submit" size="sm" variant={compact ? "outline" : "default"}>
            Activar
          </Button>
        </form>
      )}
      <form
        action={remove}
        onSubmit={(event) => {
          if (
            !window.confirm(
              "Remover este Pulse? Os sensores e o histórico desta casa desaparecem. O imóvel no CRM fica.",
            )
          ) {
            event.preventDefault();
          }
        }}
      >
        <Button type="submit" size="sm" variant="ghost" className="text-destructive">
          Remover
        </Button>
      </form>
    </div>
  );
}
