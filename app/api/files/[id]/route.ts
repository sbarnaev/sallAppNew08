import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDirectusUrl } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  const token = cookies().get("directus_access_token")?.value;
  const baseUrl = getDirectusUrl();
  if (!token || !baseUrl) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = ctx.params;
  
  // Directus использует /assets/{id} для получения файлов
  // Попробуем сначала получить файл напрямую, если не получится - через /files/{id}
  let fileUrl = `${baseUrl}/assets/${id}`;
  let r = await fetch(fileUrl, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  // Если не получилось, попробуем через /files/{id}
  if (!r.ok) {
    fileUrl = `${baseUrl}/files/${id}`;
    r = await fetch(fileUrl, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  }

  if (!r.ok) {
    return NextResponse.json({ message: "File not found" }, { status: r.status });
  }

  // Проксируем файл
  const fileData = await r.arrayBuffer();
  const contentType = r.headers.get("content-type") || "application/octet-stream";
  
  return new NextResponse(fileData, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600",
    },
  });
}

