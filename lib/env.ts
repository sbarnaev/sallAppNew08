import { logger } from "@/lib/logger";

export function getDirectusUrl(): string {
  const raw = process.env.DIRECTUS_URL || process.env.NEXT_PUBLIC_DIRECTUS_URL || "";
  let url = raw.replace(/\/+$/, "");
  
  if (!url) {
    logger.error("DIRECTUS_URL is not set! Check environment variables.");
    return "";
  }
  
  // Проверяем, что URL начинается с http:// или https://
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    logger.warn(`DIRECTUS_URL doesn't start with http:// or https://: ${url}. Adding https://`);
    url = `https://${url}`;
  }
  
  // Логи — только в dev, чтобы не шуметь на проде
  logger.debug("Directus URL (from env):", raw);
  logger.debug("Directus URL (processed):", url);
  logger.debug("URL starts with https:", url.startsWith('https://'));
  logger.debug("URL starts with http:", url.startsWith('http://'));
  
  // Парсим URL для детальной диагностики
  try {
    const urlObj = new URL(url);
    logger.debug("URL parsed:", {
      protocol: urlObj.protocol,
      hostname: urlObj.hostname,
      port: urlObj.port || '(default)',
      pathname: urlObj.pathname,
      full: urlObj.toString()
    });
  } catch (e) {
    logger.error("Failed to parse Directus URL:", e);
  }
  
  return url;
}

/**
 * Формирует URL изображения из S3 хранилища
 * @param imageId - ID изображения из JSON поля Images ID
 * @returns Полный URL к изображению в S3
 */
export function getS3ImageUrl(imageId: number | string): string {
  const s3Endpoint = process.env.S3_ENDPOINT || "https://s3.ru1.storage.beget.cloud";
  const s3Bucket = process.env.S3_BUCKET || "da0eaeb06b35-sal-app";
  const s3Path = process.env.S3_IMAGES_PATH || "sall_app/photo";
  const s3UrlFormat = process.env.S3_URL_FORMAT || "path-style"; // "path-style" или "virtual-hosted"
  
  // Убираем слеши в начале и конце пути
  const cleanPath = s3Path.replace(/^\/+|\/+$/g, '');
  
  let url: string;
  
  // Для S3 Beget может быть два формата:
  if (s3UrlFormat === "virtual-hosted") {
    // Формат: https://{bucket}.s3.ru1.storage.beget.cloud/{path}
    const hostname = s3Endpoint.replace(/^https?:\/\//, '').replace(/^s3\./, '');
    url = `https://${s3Bucket}.s3.${hostname}/${cleanPath}/${imageId}.jpeg`;
  } else {
    // Формат: https://s3.ru1.storage.beget.cloud/{bucket}/{path} (по умолчанию)
    url = `${s3Endpoint}/${s3Bucket}/${cleanPath}/${imageId}.jpeg`;
  }
  
  // Логи — только в dev
  logger.debug("S3 Image URL generated:", {
    imageId,
    endpoint: s3Endpoint,
    bucket: s3Bucket,
    path: cleanPath,
    format: s3UrlFormat,
    fullUrl: url
  });
  
  return url;
}
