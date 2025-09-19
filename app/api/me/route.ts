import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDirectusUrl } from "@/lib/env";

export async function GET() {
  const token = cookies().get("directus_access_token")?.value;
  const baseUrl = getDirectusUrl();

  if (!token || !baseUrl) {
    return NextResponse.json({ data: null }, { status: 401 });
  }

  try {
    const url = `${baseUrl}/users/me?fields=id,first_name,last_name,email,contact`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json(data || { data: null }, { status: response.status });
    }

    return NextResponse.json(data ?? { data: null });
  } catch (error) {
    return NextResponse.json(
      { message: "Cannot connect to Directus", error: String(error) },
      { status: 502 },
    );
  }
}
