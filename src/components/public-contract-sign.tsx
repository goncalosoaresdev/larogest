"use client";

import { useState } from "react";
import { toast } from "sonner";
import { requestContractOtp, signContractAsOwner } from "@/app/(app)/contracts/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FormField } from "@/components/form-field";

export function PublicContractSign({
  token,
  alreadySigned,
  locked,
}: {
  token: string;
  alreadySigned: boolean;
  locked: boolean;
}) {
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);

  if (locked) {
    return (
      <Alert>
        <AlertDescription>Este contrato foi cancelado.</AlertDescription>
      </Alert>
    );
  }
  if (alreadySigned) {
    return (
      <Alert>
        <AlertDescription>Já assinaste este contrato.</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <p className="text-sm text-muted-foreground">
          Assinatura eletrónica simples com código enviado ao teu email, nome escrito e registo de
          data, IP e documento. Não substitui aconselhamento jurídico.
        </p>
        <Button
          variant="outline"
          disabled={requesting}
          onClick={async () => {
            setRequesting(true);
            try {
              const result = await requestContractOtp(token);
              if (result.error) {
                toast.error(result.error);
                return;
              }
              setPreviewCode(result.previewCode ?? null);
              toast.success(
                result.previewCode
                  ? "Modo local — usa o código abaixo."
                  : "Código enviado para o email do contrato.",
              );
            } catch {
              toast.error("Não foi possível enviar o email. Tenta outra vez.");
            } finally {
              setRequesting(false);
            }
          }}
        >
          {requesting ? "A enviar…" : "Pedir código"}
        </Button>
        {previewCode ? (
          <Alert>
            <AlertDescription className="font-mono">Modo local — código: {previewCode}</AlertDescription>
          </Alert>
        ) : null}
        <form
          className="space-y-3"
          action={async (formData) => {
            formData.set("token", token);
            const result = await signContractAsOwner(formData);
            if (result.error) toast.error(result.error);
            else toast.success("Contrato assinado.");
          }}
        >
          <FormField label="O teu nome">
            <Input name="typedName" required />
          </FormField>
          <FormField label="Código de 6 dígitos">
            <Input name="otp" required maxLength={6} />
          </FormField>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="accepted" required className="mt-1 size-4 accent-primary" />
            Li o contrato e aceito os seus termos.
          </label>
          <Button type="submit">Assinar</Button>
        </form>
      </CardContent>
    </Card>
  );
}
