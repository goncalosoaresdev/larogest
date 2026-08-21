import { jsonError, jsonOk, limited } from "@/lib/api";
import { loadCasaLive, requireCasaApiSite } from "@/lib/casa";
import { isCasaDemoSlug, refreshDemoCasa } from "@/lib/casa-demo";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ siteId: string }> },
) {
  const blocked = limited(request, "casa-live", 120);
  if (blocked) return blocked;
  try {
    const { siteId } = await params;
    if (isCasaDemoSlug(siteId)) await refreshDemoCasa(prisma);
    const access = await requireCasaApiSite(siteId, request);
    if (access.error) return access.error;
    const live = await loadCasaLive(access.site.id);
    if (!live) return jsonError(404, "not_found");
    return jsonOk(live);
  } catch (error) {
    console.error(error);
    return jsonError(500, "server_error");
  }
}
