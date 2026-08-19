"use client";

import { useState } from "react";
import { toast } from "sonner";
import { acceptProposalByToken, rejectProposalByToken } from "@/app/(app)/proposals/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function PublicProposalActions({
  token,
  status,
  expired,
}: {
  token: string;
  status: string;
  expired: boolean;
}) {
  const [reason, setReason] = useState("");

  if (status === "ACCEPTED") {
    return (
      <Alert>
        <AlertDescription>Proposta aceite. A Laro prepara o contrato a seguir.</AlertDescription>
      </Alert>
    );
  }
  if (status === "REJECTED") {
    return (
      <Alert>
        <AlertDescription>Esta proposta foi recusada.</AlertDescription>
      </Alert>
    );
  }
  if (status === "SUPERSEDED" || expired) {
    return (
      <Alert>
        <AlertDescription>Esta proposta já não está activa.</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <p className="text-sm text-muted-foreground">
          Aceitar formaliza o interesse nos termos comerciais. O contrato é o documento jurídico.
        </p>
        <Button
          onClick={async () => {
            const result = await acceptProposalByToken(token);
            if (result.error) toast.error(result.error);
            else toast.success("Proposta aceite. Obrigado.");
          }}
        >
          Aceitar proposta
        </Button>
        <Textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Se recusares, podes indicar o motivo"
        />
        <Button
          variant="ghost"
          onClick={async () => {
            const result = await rejectProposalByToken(token, reason);
            if (result.error) toast.error(result.error);
            else toast.success("Proposta recusada.");
          }}
        >
          Recusar
        </Button>
      </CardContent>
    </Card>
  );
}
