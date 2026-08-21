import { NextResponse } from "next/server";
import { jsonError, limited, requireApiSession } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { readCarePhoto } from "@/lib/storage";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ reportId: string; photoId: string }> },
) {
  const blocked = limited(request, "files", 60);
  if (blocked) return blocked;
  const auth = await requireApiSession();
  if (auth.error) return auth.error;

  try {
    const { reportId, photoId } = await params;
    const photo = await prisma.careReportPhoto.findFirst({
      where: { id: photoId, item: { reportId } },
      select: { path: true, mime: true },
    });
    if (!photo) return jsonError(404, "not_found");
    const body = await readCarePhoto(photo.path);
    return new NextResponse(Uint8Array.from(body), {
      headers: {
        "Content-Type": photo.mime,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error(error);
    return jsonError(500, "server_error");
  }
}
