import { jsonError, jsonOk, limited } from "@/lib/api";
import { listOwnerHouses } from "@/lib/casa";
import { getSession, getSessionRole } from "@/lib/session";

export async function GET(request: Request) {
  const blocked = limited(request, "casa-houses", 60);
  if (blocked) return blocked;
  try {
    const session = await getSession(request);
    if (!session || getSessionRole(session) !== "OWNER") {
      return jsonError(401, "unauthenticated");
    }
    const houses = await listOwnerHouses(session.user.id);
    return jsonOk({
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
      },
      houses,
    });
  } catch (error) {
    console.error(error);
    return jsonError(500, "server_error");
  }
}
