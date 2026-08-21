import { jsonError, jsonOk, limited } from "@/lib/api";
import { requireCasaApiSite } from "@/lib/casa";
import { loadCasaAlertHistoryPage, parseCasaAlertHistoryCursor } from "@/lib/casa-alerts";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ siteId: string }> },
) {
  const blocked = limited(request, "casa-alerts", 60);
  if (blocked) return blocked;
  try {
    const { siteId } = await params;
    const access = await requireCasaApiSite(siteId, request);
    if (access.error) return access.error;
    const url = new URL(request.url);
    const page = await loadCasaAlertHistoryPage(access.site.id, {
      cursor: parseCasaAlertHistoryCursor(url.searchParams.get("at"), url.searchParams.get("id")),
    });
    if (!page) return jsonError(404, "not_found");
    return jsonOk(page);
  } catch (error) {
    console.error(error);
    return jsonError(500, "server_error");
  }
}
