import { jsonError, jsonOk, limited } from "@/lib/api";
import { loadCasaHistoryPage } from "@/lib/casa-history";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const blocked = limited(request, "casa-history", 60);
  if (blocked) return blocked;
  try {
    const { token } = await params;
    const url = new URL(request.url);
    const at = url.searchParams.get("at");
    const id = url.searchParams.get("id");
    const page = await loadCasaHistoryPage(token, {
      deviceId: url.searchParams.get("deviceId"),
      cursor: at && id ? { recordedAt: at, id } : null,
    });
    if (!page) return jsonError(404, "Casa não encontrada");
    return jsonOk(page);
  } catch (error) {
    console.error(error);
    return jsonError(500, "Não deu para carregar");
  }
}
