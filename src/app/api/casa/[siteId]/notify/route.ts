import { jsonError, jsonOk, limited } from "@/lib/api";
import { requireCasaApiSite } from "@/lib/casa";
import { DEFAULT_CASA_NOTIFY, parseClockMinutes, saveCasaNotifyPrefs, type CasaNotifyPrefs } from "@/lib/casa-notify";
import { prisma } from "@/lib/prisma";

const BOOLS = ["push", "water", "offline", "battery", "climate", "quietEnabled"] as const;
const CLOCKS = ["quietStart", "quietEnd"] as const;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ siteId: string }> },
) {
  const blocked = limited(request, "casa-notify", 60);
  if (blocked) return blocked;
  try {
    const { siteId } = await params;
    const access = await requireCasaApiSite(siteId, request);
    if (access.error) return access.error;
    if (access.site.demo) return jsonError(404, "not_found");

    const row = await prisma.pulseNotifySettings.findUnique({ where: { siteId: access.site.id } });
    const prefs = row
      ? {
          push: row.push,
          water: row.water,
          offline: row.offline,
          battery: row.battery,
          climate: row.climate,
          quietEnabled: row.quietEnabled,
          quietStart: row.quietStart,
          quietEnd: row.quietEnd,
        }
      : { ...DEFAULT_CASA_NOTIFY };

    return jsonOk(prefs);
  } catch (error) {
    console.error(error);
    return jsonError(500, "server_error");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ siteId: string }> },
) {
  const blocked = limited(request, "casa-notify-write", 40);
  if (blocked) return blocked;
  try {
    const { siteId } = await params;
    const access = await requireCasaApiSite(siteId, request);
    if (access.error) return access.error;

    const body = (await request.json().catch(() => null)) as Partial<CasaNotifyPrefs> | null;
    if (!body || typeof body !== "object") return jsonError(400, "invalid_body");

    const patch: Partial<CasaNotifyPrefs> = {};
    for (const key of BOOLS) {
      if (typeof body[key] === "boolean") patch[key] = body[key];
    }
    for (const key of CLOCKS) {
      if (typeof body[key] === "string" && parseClockMinutes(body[key]) != null) patch[key] = body[key];
    }
    const prefs = await saveCasaNotifyPrefs(access.site.id, patch);
    return jsonOk(prefs);
  } catch (error) {
    console.error(error);
    return jsonError(500, "server_error");
  }
}
