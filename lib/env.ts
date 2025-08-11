export function getDirectusUrl(): string {
  return process.env.DIRECTUS_URL || process.env.NEXT_PUBLIC_DIRECTUS_URL || "";
}
