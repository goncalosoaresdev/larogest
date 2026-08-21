import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { CareReportForm } from "@/components/care-report-form";
import { careReportStatusLabel } from "@/lib/labels";

export default async function CareReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const report = await prisma.careReport.findUnique({ where: { id } });
  if (!report) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Relatório de visita"
        description={careReportStatusLabel[report.status]}
      />
      <CareReportForm report={report} />
    </div>
  );
}
