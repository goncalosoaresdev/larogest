import { isApnsToken, jsonError, jsonOk, limited, parseJsonBody } from "@/lib/api";
import { requireCasaApiOwner } from "@/lib/casa";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const blocked = limited(request, "casa-devices-write", 20);
  if (blocked) return blocked;
  try {
    const access = await requireCasaApiOwner(request);
    if (access.error) return access.error;

    const body = await parseJsonBody<{ platform?: string; token?: string }>(request);
    const token = body?.token?.replace(/\s/g, "").toLowerCase() ?? "";
    if (body?.platform !== "ios" || !isApnsToken(token)) {
      return jsonError(400, "invalid_body");
    }

    await prisma.casaPushDevice.upsert({
      where: { apnsToken: token },
      create: {
        userId: access.session.user.id,
        platform: "IOS",
        apnsToken: token,
      },
      update: {
        userId: access.session.user.id,
        platform: "IOS",
        endpoint: null,
        p256dh: null,
        auth: null,
      },
    });

    return jsonOk({ ok: true });
  } catch (error) {
    console.error(error);
    return jsonError(500, "server_error");
  }
}

export async function DELETE(request: Request) {
  const blocked = limited(request, "casa-devices-write", 20);
  if (blocked) return blocked;
  try {
    const access = await requireCasaApiOwner(request);
    if (access.error) return access.error;

    const body = await parseJsonBody<{ platform?: string; token?: string }>(request);
    const token = body?.token?.replace(/\s/g, "").toLowerCase() ?? "";
    if (body?.platform !== "ios" || !isApnsToken(token)) {
      return jsonError(400, "invalid_body");
    }

    await prisma.casaPushDevice.deleteMany({
      where: { userId: access.session.user.id, apnsToken: token },
    });
    return jsonOk({ ok: true });
  } catch (error) {
    console.error(error);
    return jsonError(500, "server_error");
  }
}
