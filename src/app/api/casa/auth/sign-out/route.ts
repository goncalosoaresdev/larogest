import { jsonError, jsonOk, limited } from "@/lib/api";
import { auth } from "@/lib/auth";
import { authHeadersFrom } from "@/lib/request-auth";

export async function POST(request: Request) {
  const blocked = limited(request, "casa-auth-sign-out", 30);
  if (blocked) return blocked;
  try {
    const headers = authHeadersFrom(request);
    const session = await auth.api.getSession({ headers });
    if (!session) return jsonError(401, "Não autenticado");
    await auth.api.signOut({ headers });
    return jsonOk({ ok: true });
  } catch (error) {
    console.error(error);
    return jsonError(500, "Não deu para sair");
  }
}
