import { isCasaToken, jsonError, jsonOk, limited } from "@/lib/api";
import { DEFAULT_CASA_NOTIFY, parseClockMinutes, saveCasaNotifyPrefs, type CasaNotifyPrefs } from "@/lib/casa-notify";
import { prisma } from "@/lib/prisma";
import { isPulseSiteActive } from "@/lib/pulse";

const BOOLS = ["push", "water", "offline", "battery", "climate", "quietEnabled"] as const;
const CLOCKS = ["quietStart", "quietEnd"] as const;

async function activeSite(token: string) {
  if (!isCasaToken(token)) return null;
  const site = await prisma.pulseSite.findUnique({
    where: { publicToken: token },
    select: { id: true, status: true },
  });
  if (!site || !isPulseSiteActive(site.status)) return null;
  return site;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const blocked = limited(request, "casa-notify", 60);
  if (blocked) return blocked;
  try {
    const { token } = await params;
    const site = await activeSite(token);
    if (!site) return jsonError(404, "Casa não encontrada");

    const row = await prisma.pulseNotifySettings.findUnique({ where: { siteId: site.id } });
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
    return jsonError(500, "Não deu para carregar");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const blocked = limited(request, "casa-notify-write", 40);
  if (blocked) return blocked;
  try {
    const { token } = await params;
    const site = await activeSite(token);
    if (!site) return jsonError(404, "Casa não encontrada");

    const body = (await request.json().catch(() => null)) as Partial<CasaNotifyPrefs> | null;
    if (!body || typeof body !== "object") return jsonError(400, "Pedido inválido");

    const patch: Partial<CasaNotifyPrefs> = {};
    for (const key of BOOLS) {
      if (typeof body[key] === "boolean") patch[key] = body[key];
    }
    for (const key of CLOCKS) {
      if (typeof body[key] === "string" && parseClockMinutes(body[key]) != null) patch[key] = body[key];
    }
    const prefs = await saveCasaNotifyPrefs(site.id, patch);
    return jsonOk(prefs);
  } catch (error) {
    console.error(error);
    return jsonError(500, "Não deu para guardar");
  }
}
