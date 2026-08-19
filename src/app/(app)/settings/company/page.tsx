import { prisma } from "@/lib/prisma";
import { saveCompany } from "@/app/(app)/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { FormField } from "@/components/form-field";

export default async function CompanyPage() {
  const company = await prisma.companySettings.findUnique({ where: { id: "default" } });

  return (
    <div className="space-y-6">
      <PageHeader title="Empresa" description="Identidade da Laro nos documentos e no CRM." />
      <Card className="max-w-xl">
        <CardContent className="pt-6">
          <form action={saveCompany} className="space-y-4">
            <FormField label="Nome">
              <Input name="name" defaultValue={company?.name ?? "Laro"} required />
            </FormField>
            <FormField label="NIF">
              <Input name="nif" defaultValue={company?.nif ?? ""} required />
            </FormField>
            <FormField label="Morada">
              <Input name="address" defaultValue={company?.address ?? ""} required />
            </FormField>
            <FormField label="Email">
              <Input name="email" type="email" defaultValue={company?.email ?? ""} required />
            </FormField>
            <FormField label="Telefone">
              <Input name="phone" defaultValue={company?.phone ?? ""} required />
            </FormField>
            <FormField label="Website">
              <Input name="website" defaultValue={company?.website ?? ""} />
            </FormField>
            <Button type="submit">Guardar</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
