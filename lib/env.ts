export function getDirectusUrl(): string {
  const raw = process.env.DIRECTUS_URL || process.env.NEXT_PUBLIC_DIRECTUS_URL || "";
  return raw.replace(/\/+$/, "");
}
