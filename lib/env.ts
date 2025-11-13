export function getDirectusUrl(): string {
  const raw = process.env.DIRECTUS_URL || process.env.NEXT_PUBLIC_DIRECTUS_URL || "";
  const url = raw.replace(/\/+$/, "");
  if (!url) {
    console.error("DIRECTUS_URL is not set! Check environment variables.");
  }
  return url;
}
