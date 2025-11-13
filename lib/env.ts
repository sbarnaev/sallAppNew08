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
  console.log("🔍 Directus URL (from env):", raw);
  console.log("🔍 Directus URL (processed):", url);
  console.log("🔍 URL starts with https:", url.startsWith('https://'));
  console.log("🔍 URL starts with http:", url.startsWith('http://'));
  
  // Парсим URL для детальной диагностики
  try {
    const urlObj = new URL(url);
    console.log("🔍 URL parsed:", {
      protocol: urlObj.protocol,
      hostname: urlObj.hostname,
      port: urlObj.port || '(default)',
      pathname: urlObj.pathname,
      full: urlObj.toString()
    });
  } catch (e) {
    console.error("🔍 Failed to parse URL:", e);
  }
  
  return url;
}
