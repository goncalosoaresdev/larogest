import { jsonError, jsonOk, limited } from "@/lib/api";
import { getCasaSnapshot, requireCasaApiSite } from "@/lib/casa";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ siteId: string }> },
) {
  const blocked = limited(request, "casa-snapshot", 60);
  if (blocked) return blocked;
  try {
    const { siteId } = await params;
    const access = await requireCasaApiSite(siteId);
    if (access.error) return access.error;
    const snapshot = await getCasaSnapshot(access.site.id);
    if (!snapshot) return jsonError(404, "Casa não encontrada");
    return jsonOk(snapshot);
  } catch (error) {
    console.error(error);
    return jsonError(500, "Não deu para carregar");
  }
}
