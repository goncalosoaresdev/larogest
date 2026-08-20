import { jsonError, jsonOk, limited } from "@/lib/api";
import { requireCasaApiSite } from "@/lib/casa";
import { loadCasaHistoryPage } from "@/lib/casa-history";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ siteId: string }> },
) {
  const blocked = limited(request, "casa-history", 60);
  if (blocked) return blocked;
  try {
    const { siteId } = await params;
    const access = await requireCasaApiSite(siteId, request);
    if (access.error) return access.error;
    const url = new URL(request.url);
    const at = url.searchParams.get("at");
    const id = url.searchParams.get("id");
    const page = await loadCasaHistoryPage(access.site.id, {
      deviceId: url.searchParams.get("deviceId"),
      cursor: at && id ? { recordedAt: at, id } : null,
    });
    if (!page) return jsonError(404, "not_found");
    return jsonOk(page);
  } catch (error) {
    console.error(error);
    return jsonError(500, "server_error");
  }
}
