export function getDirectusUrl(): string {
  const raw = process.env.DIRECTUS_URL || process.env.NEXT_PUBLIC_DIRECTUS_URL || "";
  let url = raw.replace(/\/+$/, "");
  
  if (!url) {
    console.error("DIRECTUS_URL is not set! Check environment variables.");
    return "";
  }
  
  // Проверяем, что URL начинается с http:// или https://
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    console.warn(`DIRECTUS_URL doesn't start with http:// or https://: ${url}. Adding https://`);
    url = `https://${url}`;
  }
  
  // ВРЕМЕННО: Всегда логируем URL для диагностики SSL ошибки
  console.log("[DEBUG] Directus URL (from env):", raw);
  console.log("[DEBUG] Directus URL (processed):", url);
  console.log("[DEBUG] URL starts with https:", url.startsWith('https://'));
  console.log("[DEBUG] URL starts with http:", url.startsWith('http://'));
  
  // Парсим URL для детальной диагностики
  try {
    const urlObj = new URL(url);
    console.log("[DEBUG] URL parsed:", {
      protocol: urlObj.protocol,
      hostname: urlObj.hostname,
      port: urlObj.port || '(default)',
      pathname: urlObj.pathname,
      full: urlObj.toString()
    });
  } catch (e) {
    console.error("[DEBUG] Failed to parse URL:", e);
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
  
  // Убираем слеши в начале и конце пути
  const cleanPath = s3Path.replace(/^\/+|\/+$/g, '');
  
  // Формируем URL: https://s3.ru1.storage.beget.cloud/da0eaeb06b35-sal-app/sall_app/photo/30.jpeg
  const url = `${s3Endpoint}/${s3Bucket}/${cleanPath}/${imageId}.jpeg`;
  
  return url;
}
