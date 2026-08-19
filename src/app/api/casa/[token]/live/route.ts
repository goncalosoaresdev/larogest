import { jsonError, jsonOk, limited } from "@/lib/api";
import { loadCasaLive } from "@/lib/casa";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const blocked = limited(request, "casa-live", 120);
  if (blocked) return blocked;
  try {
    const { token } = await params;
    const live = await loadCasaLive(token);
    if (!live) return jsonError(404, "Casa não encontrada");
    return jsonOk(live);
  } catch (error) {
    console.error(error);
    return jsonError(500, "Não deu para carregar");
  }
}
