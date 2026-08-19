import { PageHeader } from "@/components/page-header";
import { createLead } from "@/app/(app)/leads/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField, NativeSelect } from "@/components/form-field";

export default function NewLeadPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Nova lead" description="Regista o proprietário e o imóvel numa só ficha." />
      <form action={createLead} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Proprietário</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField label="Nome">
              <Input name="name" required />
            </FormField>
            <FormField label="Email">
              <Input name="email" type="email" />
            </FormField>
            <FormField label="Telefone / WhatsApp">
              <Input name="phone" />
            </FormField>
            <FormField label="NIF">
              <Input name="nif" />
            </FormField>
            <FormField label="Tipo">
              <NativeSelect name="personType" defaultValue="INDIVIDUAL">
                <option value="INDIVIDUAL">Particular</option>
                <option value="COMPANY">Empresa</option>
              </NativeSelect>
            </FormField>
            <FormField label="Empresa (se aplicável)">
              <Input name="companyName" />
            </FormField>
            <div className="sm:col-span-2">
              <FormField label="Morada do proprietário">
                <Input name="ownerAddress" />
              </FormField>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Imóvel</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FormField label="Morada ou zona">
                <Input name="address" required placeholder="Rua, freguesia ou só a cidade" />
              </FormField>
            </div>
            <FormField label="Cidade">
              <Input name="city" />
            </FormField>
            <FormField label="Tipologia">
              <NativeSelect name="typology" defaultValue="APARTMENT">
                <option value="APARTMENT">Apartamento</option>
                <option value="HOUSE">Moradia</option>
                <option value="VILLA">Villa</option>
                <option value="STUDIO">Estúdio</option>
                <option value="OTHER">Outro</option>
              </NativeSelect>
            </FormField>
            <FormField label="Capacidade">
              <Input name="capacity" type="number" min={1} />
            </FormField>
            <FormField label="RNAL">
              <Input name="rnal" placeholder="Se já existir" />
            </FormField>
            <FormField label="Serviço">
              <NativeSelect name="service" defaultValue="AL_MANAGEMENT">
                <option value="AL_MANAGEMENT">Gestão de alojamento local</option>
                <option value="SCHEDULED_VISITS">Visitas programadas</option>
              </NativeSelect>
            </FormField>
            <FormField label="Origem">
              <NativeSelect name="source" defaultValue="WHATSAPP">
                <option value="WHATSAPP">WhatsApp</option>
                <option value="WEBSITE">laro.pt</option>
                <option value="REFERRAL">Referência</option>
                <option value="MANUAL">Manual</option>
                <option value="OTHER">Outro</option>
              </NativeSelect>
            </FormField>
            <div className="sm:col-span-2">
              <FormField label="Notas">
                <Textarea name="notes" placeholder="O que pediu, datas, impressão da conversa" />
              </FormField>
            </div>
          </CardContent>
        </Card>

        <Button type="submit">Guardar lead</Button>
      </form>
    </div>
  );
}
