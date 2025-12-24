import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDirectusUrl } from "@/lib/env";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  const token = cookies().get("directus_access_token")?.value;
  const baseUrl = getDirectusUrl();
  if (!token || !baseUrl) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = ctx.params;
  
  logger.debug(`[API/files] Requesting file with ID: ${id}`);
  
  // Directus использует /assets/{id} для получения файлов
  // Попробуем сначала получить файл напрямую, если не получится - через /files/{id}
  let fileUrl = `${baseUrl}/assets/${id}`;
  let r = await fetch(fileUrl, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  logger.debug(`[API/files] Directus /assets/${id} response: ${r.status}`);

  // Если не получилось, попробуем через /files/{id}
  if (!r.ok) {
    fileUrl = `${baseUrl}/files/${id}`;
    r = await fetch(fileUrl, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    logger.debug(`[API/files] Directus /files/${id} response: ${r.status}`);
  }

  // Если Directus не может вернуть файл (403 или 404), пробуем S3 напрямую
  if (!r.ok && (r.status === 403 || r.status === 404)) {
    // Используем те же переменные, что и в getS3ImageUrl для консистентности
    const s3Endpoint = process.env.S3_ENDPOINT || process.env.NEXT_PUBLIC_S3_ENDPOINT || "https://s3.ru1.storage.beget.cloud";
    const s3Bucket = process.env.S3_BUCKET || process.env.NEXT_PUBLIC_S3_BUCKET || "da0eaeb06b35-sal-app";
    const s3Path = process.env.S3_IMAGES_PATH || process.env.NEXT_PUBLIC_S3_IMAGES_PATH || "sall_app/photo";
    const s3UrlFormat = process.env.S3_URL_FORMAT || "path-style";
    const cleanPath = s3Path.replace(/^\/+|\/+$/g, '');
    
    // Формируем URL в том же формате, что и getS3ImageUrl
    let s3Url: string;
    if (s3UrlFormat === "virtual-hosted") {
      const hostname = s3Endpoint.replace(/^https?:\/\//, '').replace(/^s3\./, '');
      s3Url = `https://${s3Bucket}.s3.${hostname}/${cleanPath}/${id}.jpeg`;
    } else {
      s3Url = `${s3Endpoint}/${s3Bucket}/${cleanPath}/${id}.jpeg`;
    }
    
    // Пробуем получить файл из S3
    try {
      logger.debug(`[API/files] Trying S3 fallback: ${s3Url}`);
      const s3Response = await fetch(s3Url, {
        cache: "no-store",
      });
      
      logger.debug(`[API/files] S3 response: ${s3Response.status}`);
      
      if (s3Response.ok) {
        const fileData = await s3Response.arrayBuffer();
        const contentType = s3Response.headers.get("content-type") || "image/jpeg";
        
        logger.debug(`[API/files] Successfully fetched from S3, size: ${fileData.byteLength} bytes`);
        
        return new NextResponse(fileData, {
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=3600",
          },
        });
      } else {
        logger.warn(`[API/files] S3 fetch failed with status ${s3Response.status} for URL: ${s3Url}`);
      }
    } catch (s3Error: any) {
      // Если S3 тоже не работает, продолжаем с ошибкой Directus
      logger.error(`[API/files] Failed to fetch from S3: ${s3Url}`, {
        error: s3Error?.message || String(s3Error),
        stack: s3Error?.stack?.substring(0, 200)
      });
    }
  }

  if (!r.ok) {
    logger.error(`[API/files] Failed to fetch file ${id}`, {
      directusStatus: r.status,
      directusStatusText: r.statusText
    });
    return NextResponse.json({ message: "File not found" }, { status: r.status });
  }

  // Проксируем файл из Directus
  const fileData = await r.arrayBuffer();
  const contentType = r.headers.get("content-type") || "application/octet-stream";
  
  return new NextResponse(fileData, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600",
    },
  });
}

