"use client";

import { useActionState } from "react";
import Link from "next/link";
import { CARE_CHECKLIST_KEYS, type CareChecklistKey, type CareChecklistStatus } from "@/lib/care-report";
import { careChecklistLabel, careChecklistStatusLabel, careReportStatusLabel, careReportVerdictLabel } from "@/lib/labels";
import { publishCareReport, saveCareReport } from "@/app/(app)/visitas/relatorios/actions";
import { FormField, NativeSelect } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type CareReportFormValues = {
  id?: string;
  propertyId: string;
  visitId: string;
  visitedAt: string;
  visitedByName: string;
  verdict: "OK" | "ATTENTION" | "URGENT";
  summary: string;
  nextVisitAt: string;
  status?: "DRAFT" | "PUBLISHED";
  checklist: Array<{
    key: CareChecklistKey;
    status: CareChecklistStatus;
    note: string;
    photos: { id: string; remove?: boolean }[];
  }>;
};

export function CareReportFields({
  values,
  properties,
  visits,
}: {
  values: CareReportFormValues;
  properties: { id: string; label: string }[];
  visits: { id: string; label: string }[];
}) {
  const [saveState, saveAction, saving] = useActionState(saveCareReport, null);
  const [publishState, publishAction, publishing] = useActionState(publishCareReport, null);
  const restored =
    saveState && publishState
      ? saveState.at >= publishState.at
        ? saveState
        : publishState
      : (saveState ?? publishState);
  const current = restored?.values
    ? { ...values, ...restored.values, status: values.status, id: restored.values.id ?? values.id }
    : values;
  const error = restored?.error;
  const busy = saving || publishing;
  const checklist = CARE_CHECKLIST_KEYS.map((key) => current.checklist.find((row) => row.key === key) ?? {
    key,
    status: "SKIPPED" as const,
    note: "",
    photos: [],
  });

  return (
    <form key={restored?.at ?? "new"} className="space-y-4">
      {current.id ? <input type="hidden" name="id" value={current.id} /> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-4 pt-6">
            <FormField label="Imóvel">
              <NativeSelect name="propertyId" defaultValue={current.propertyId} required>
                <option value="">Escolhe o imóvel</option>
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="Visita na agenda (opcional)">
              <NativeSelect name="visitId" defaultValue={current.visitId}>
                <option value="">Sem visita ligada</option>
                {visits.map((visit) => (
                  <option key={visit.id} value={visit.id}>
                    {visit.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Quando">
                <Input name="visitedAt" type="datetime-local" required defaultValue={current.visitedAt} />
              </FormField>
              <FormField label="Quem foi">
                <Input name="visitedByName" required defaultValue={current.visitedByName} placeholder="Ana" />
              </FormField>
            </div>
            <FormField label="Veredicto">
              <NativeSelect name="verdict" defaultValue={current.verdict} required>
                <option value="OK">{careReportVerdictLabel.OK}</option>
                <option value="ATTENTION">{careReportVerdictLabel.ATTENTION}</option>
                <option value="URGENT">{careReportVerdictLabel.URGENT}</option>
              </NativeSelect>
            </FormField>
            <FormField label="Resumo para o proprietário (opcional)">
              <Textarea
                name="summary"
                rows={5}
                defaultValue={current.summary}
                placeholder="Casa arejada, sem cheiros. Recolhemos o correio. Portas e água confirmadas."
              />
            </FormField>
            <p className="-mt-2 text-sm text-muted-foreground">
              A lista à direita é o que o proprietário vê. O resumo é só a carta, se quiseres.
            </p>
            <FormField label="Próxima visita (opcional)">
              <Input name="nextVisitAt" type="datetime-local" defaultValue={current.nextVisitAt} />
            </FormField>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" formAction={saveAction} variant="outline" disabled={busy}>
                {current.status === "PUBLISHED" ? "Guardar alterações" : "Guardar rascunho"}
              </Button>
              <Button type="submit" formAction={publishAction} disabled={busy}>
                Publicar na Casa
              </Button>
              {current.status ? (
                <p className="self-center text-sm text-muted-foreground">{careReportStatusLabel[current.status]}</p>
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground">
              Visitas de conhecimento não aparecem aqui. O proprietário só vê o relatório depois de publicar.
            </p>
            <Link href="/visitas" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
              Voltar às visitas
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3 pt-6">
            <h2 className="text-sm font-medium">O que foi feito</h2>
            <p className="text-sm text-muted-foreground">
              Cada ponto pode levar as suas fotos. Não desta vez fica de fora da Casa.
            </p>
            {checklist.map((row) => (
              <div key={row.key} className="space-y-3 rounded-xl border p-3">
                <div className="grid gap-3 sm:grid-cols-[1fr_160px] sm:items-center">
                  <p className="text-sm font-medium">{careChecklistLabel[row.key]}</p>
                  <NativeSelect name={`check.${row.key}`} defaultValue={row.status}>
                    <option value="DONE">{careChecklistStatusLabel.DONE}</option>
                    <option value="SKIPPED">{careChecklistStatusLabel.SKIPPED}</option>
                    <option value="ATTENTION">{careChecklistStatusLabel.ATTENTION}</option>
                  </NativeSelect>
                </div>
                <Input name={`note.${row.key}`} defaultValue={row.note} placeholder="Nota para o proprietário (opcional)" />
                <Input name={`photos.${row.key}`} type="file" accept="image/jpeg,image/png,image/webp" multiple />
                {row.photos.length ? (
                  <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {row.photos.map((photo) => (
                      <li key={photo.id} className="space-y-2">
                        <input type="hidden" name="keepPhoto" value={`${row.key}:${photo.id}`} />
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/files/care-reports/${current.id}/${photo.id}`}
                          alt=""
                          className="aspect-[4/3] w-full rounded-lg object-cover"
                        />
                        <label className="flex items-center gap-2 text-sm text-muted-foreground">
                          <input type="checkbox" name="removePhoto" value={photo.id} defaultChecked={photo.remove} />
                          Retirar
                        </label>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
            <p className="text-sm text-muted-foreground">JPEG, PNG ou WebP. Até 3 fotos por ponto, 8 no total.</p>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}
