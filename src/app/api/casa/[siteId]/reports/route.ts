import { jsonError, jsonOk, limited } from "@/lib/api";
import { requireCasaApiSite } from "@/lib/casa";
import { loadCasaReports } from "@/lib/casa-reports";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ siteId: string }> },
) {
  const blocked = limited(request, "casa-reports", 60);
  if (blocked) return blocked;
  try {
    const { siteId } = await params;
    const access = await requireCasaApiSite(siteId, request);
    if (access.error) return access.error;
    const reports = await loadCasaReports(access.site.id);
    if (!reports) return jsonError(404, "not_found");
    return jsonOk({ reports });
  } catch (error) {
    console.error(error);
    return jsonError(500, "server_error");
  }
}
