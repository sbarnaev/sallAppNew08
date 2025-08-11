import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const res = NextResponse.redirect(new URL("/login", req.url));
  res.cookies.set("directus_access_token", "", { httpOnly: true, expires: new Date(0), path: "/" });
  res.cookies.set("directus_refresh_token", "", { httpOnly: true, expires: new Date(0), path: "/" });
  return res;
}
