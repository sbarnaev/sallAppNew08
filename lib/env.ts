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
  
  // Логируем URL для диагностики (без чувствительных данных)
  if (process.env.NODE_ENV !== 'production' || process.env.DEBUG_DIRECTUS_URL === 'true') {
    console.log("Directus URL:", url.replace(/\/\/.*@/, '//***@')); // Скрываем credentials если есть
  }
  
  return url;
}
