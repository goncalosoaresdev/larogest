"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function SendLinkButton({
  label,
  sentLabel,
  action,
  className,
}: {
  label: string;
  sentLabel: string;
  action: () => Promise<{ error?: string; link?: string; delivered?: boolean } | void>;
  className?: string;
}) {
  const [pending, setPending] = useState(false);

  return (
    <Button
      className={className}
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          const result = await action();
          if (!result) return;
          if (result.error) {
            toast.error(result.error);
            return;
          }
          if (result.link) {
            toast.success(result.delivered ? sentLabel : "Email em modo local. Copia o link.", {
              description: result.link,
            });
          }
        } catch {
          toast.error("Não foi possível enviar o email. Tenta outra vez.");
        } finally {
          setPending(false);
        }
      }}
    >
      {pending ? "A enviar…" : label}
    </Button>
  );
}
