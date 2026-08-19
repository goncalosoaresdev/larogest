import { jsonError, jsonOk, limited } from "@/lib/api";
import { getCasaSnapshot } from "@/lib/casa";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const blocked = limited(request, "casa-snapshot", 60);
  if (blocked) return blocked;
  try {
    const { token } = await params;
    const snapshot = await getCasaSnapshot(token);
    if (!snapshot) return jsonError(404, "Casa não encontrada");
    return jsonOk(snapshot);
  } catch (error) {
    console.error(error);
    return jsonError(500, "Não deu para carregar");
  }
}
