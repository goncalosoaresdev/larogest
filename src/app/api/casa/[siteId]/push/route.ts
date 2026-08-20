import { isHttpsUrl, isPushKey, jsonError, jsonOk, limited, parseJsonBody } from "@/lib/api";
import { requireCasaApiSite } from "@/lib/casa";
import { prisma } from "@/lib/prisma";
import { vapidConfig } from "@/lib/vapid";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ siteId: string }> },
) {
  const blocked = limited(request, "casa-push", 30);
  if (blocked) return blocked;
  try {
    const { siteId } = await params;
    const access = await requireCasaApiSite(siteId, request);
    if (access.error) return access.error;
    const vapid = vapidConfig();
    if (!vapid) return jsonError(503, "push_unconfigured");
    return jsonOk({ publicKey: vapid.publicKey });
  } catch (error) {
    console.error(error);
    return jsonError(500, "server_error");
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ siteId: string }> },
) {
  const blocked = limited(request, "casa-push-write", 20);
  if (blocked) return blocked;
  try {
    const { siteId } = await params;
    const access = await requireCasaApiSite(siteId, request);
    if (access.error) return access.error;

    const body = await parseJsonBody<{
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    }>(request);
    if (!body?.endpoint || !isHttpsUrl(body.endpoint) || !isPushKey(body.keys?.p256dh ?? "") || !isPushKey(body.keys?.auth ?? "", 8, 64)) {
      return jsonError(400, "invalid_body");
    }

    await prisma.pulsePushSubscription.upsert({
      where: { endpoint: body.endpoint },
      create: {
        siteId: access.site.id,
        endpoint: body.endpoint,
        p256dh: body.keys!.p256dh!,
        auth: body.keys!.auth!,
      },
      update: {
        siteId: access.site.id,
        p256dh: body.keys!.p256dh!,
        auth: body.keys!.auth!,
      },
    });

    return jsonOk({ ok: true });
  } catch (error) {
    console.error(error);
    return jsonError(500, "server_error");
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ siteId: string }> },
) {
  const blocked = limited(request, "casa-push-write", 20);
  if (blocked) return blocked;
  try {
    const { siteId } = await params;
    const access = await requireCasaApiSite(siteId, request);
    if (access.error) return access.error;

    const body = await parseJsonBody<{ endpoint?: string }>(request);
    if (body?.endpoint) {
      if (!isHttpsUrl(body.endpoint)) return jsonError(400, "invalid_body");
      await prisma.pulsePushSubscription.deleteMany({
        where: { siteId: access.site.id, endpoint: body.endpoint },
      });
    }
    return jsonOk({ ok: true });
  } catch (error) {
    console.error(error);
    return jsonError(500, "server_error");
  }
}
