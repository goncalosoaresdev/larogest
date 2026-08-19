import { isCasaToken, isHttpsUrl, isPushKey, jsonError, jsonOk, limited, parseJsonBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { isPulseSiteActive } from "@/lib/pulse";
import { vapidConfig } from "@/lib/vapid";

async function activeSite(token: string) {
  if (!isCasaToken(token)) return null;
  const site = await prisma.pulseSite.findUnique({ where: { publicToken: token } });
  if (!site || !isPulseSiteActive(site.status)) return null;
  return site;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const blocked = limited(request, "casa-push", 30);
  if (blocked) return blocked;
  try {
    const { token } = await params;
    const site = await activeSite(token);
    if (!site) return jsonError(404, "Casa não encontrada");
    const vapid = vapidConfig();
    if (!vapid) return jsonError(503, "Web Push não configurado");
    return jsonOk({ publicKey: vapid.publicKey });
  } catch (error) {
    console.error(error);
    return jsonError(500, "Não deu para carregar");
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const blocked = limited(request, "casa-push-write", 20);
  if (blocked) return blocked;
  try {
    const { token } = await params;
    const site = await activeSite(token);
    if (!site) return jsonError(404, "Casa não encontrada");

    const body = await parseJsonBody<{
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    }>(request);
    if (!body?.endpoint || !isHttpsUrl(body.endpoint) || !isPushKey(body.keys?.p256dh ?? "") || !isPushKey(body.keys?.auth ?? "", 8, 64)) {
      return jsonError(400, "Subscrição inválida");
    }

    await prisma.pulsePushSubscription.upsert({
      where: { endpoint: body.endpoint },
      create: {
        siteId: site.id,
        endpoint: body.endpoint,
        p256dh: body.keys!.p256dh!,
        auth: body.keys!.auth!,
      },
      update: {
        siteId: site.id,
        p256dh: body.keys!.p256dh!,
        auth: body.keys!.auth!,
      },
    });

    return jsonOk({ ok: true });
  } catch (error) {
    console.error(error);
    return jsonError(500, "Não deu para guardar");
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const blocked = limited(request, "casa-push-write", 20);
  if (blocked) return blocked;
  try {
    const { token } = await params;
    const site = await activeSite(token);
    if (!site) return jsonError(404, "Casa não encontrada");

    const body = await parseJsonBody<{ endpoint?: string }>(request);
    if (body?.endpoint) {
      if (!isHttpsUrl(body.endpoint)) return jsonError(400, "Subscrição inválida");
      await prisma.pulsePushSubscription.deleteMany({ where: { siteId: site.id, endpoint: body.endpoint } });
    }
    return jsonOk({ ok: true });
  } catch (error) {
    console.error(error);
    return jsonError(500, "Não deu para guardar");
  }
}
