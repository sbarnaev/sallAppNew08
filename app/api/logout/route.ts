import { NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/fetchers";

export async function POST(req: Request) {
  const baseUrl = getBaseUrl();
  const res = NextResponse.redirect(new URL("/login", baseUrl));
  res.cookies.set("directus_access_token", "", { httpOnly: true, expires: new Date(0), path: "/" });
  res.cookies.set("directus_refresh_token", "", { httpOnly: true, expires: new Date(0), path: "/" });
  return res;
}
