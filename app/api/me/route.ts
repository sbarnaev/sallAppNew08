import { NextResponse } from "next/server";
import { fetchDirectusWithAuth } from "@/lib/guards";

export async function GET() {
  try {
    const response = await fetchDirectusWithAuth("users/me?fields=id,first_name,last_name,email,contact");
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
