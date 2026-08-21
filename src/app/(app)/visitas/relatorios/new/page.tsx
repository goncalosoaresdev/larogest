import { PageHeader } from "@/components/page-header";
import { CareReportForm } from "@/components/care-report-form";

export default async function NewCareReportPage({
  searchParams,
}: {
  searchParams: Promise<{ visitId?: string }>;
}) {
  const { visitId } = await searchParams;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Novo relatório"
        description="Carta da visita para o proprietário. Só vai para a Casa depois de publicares."
      />
      <CareReportForm visitId={visitId} />
    </div>
  );
}
