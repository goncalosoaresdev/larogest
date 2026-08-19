import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const start = `/casa/${token}`;
  return NextResponse.json(
    {
      name: "Laro Pulse",
      short_name: "Pulse",
      description: "Estado da casa, em tempo real, com a Laro.",
      start_url: start,
      scope: start,
      display: "standalone",
      background_color: "#f7f4ed",
      theme_color: "#f7f4ed",
      icons: [
        { src: "/casa-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/casa-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/casa-icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    {
      headers: {
        "Content-Type": "application/manifest+json",
        "Cache-Control": "public, max-age=3600",
      },
    },
  );
}
