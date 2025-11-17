import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDirectusUrl } from "@/lib/env";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Создает новую экспресс-консультацию
 */
export async function POST(req: NextRequest) {
  const token = cookies().get("directus_access_token")?.value;
  const baseUrl = getDirectusUrl();
  
  if (!token || !baseUrl) {
    return NextResponse.json({ message: "Unauthorized or no DIRECTUS_URL" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { client_id } = body;

    if (!client_id) {
      return NextResponse.json({ message: "client_id is required" }, { status: 400 });
    }

    // Получаем текущего пользователя (консультанта)
    const meRes = await fetch(`${baseUrl}/users/me`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    });

    if (!meRes.ok) {
      return NextResponse.json({ message: "Failed to get current user" }, { status: 500 });
    }

    const meData = await meRes.json().catch(() => ({}));
    const ownerUserId = meData?.data?.id;

    if (!ownerUserId) {
      return NextResponse.json({ message: "Failed to get user ID" }, { status: 500 });
    }

    // Создаем экспресс-консультацию
    const payload = {
      client_id: Number(client_id),
      owner_user: ownerUserId,
      type: "express",
      status: "in_progress",
    };

    const url = `${baseUrl}/items/consultations`;
    const r = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const data = await r.json().catch(() => ({}));

    if (!r.ok) {
      logger.error("Error creating express consultation:", data);
      return NextResponse.json(
        { message: data?.errors?.[0]?.message || "Failed to create consultation" },
        { status: r.status }
      );
    }

    return NextResponse.json(data, { status: 200 });
  } catch (error: any) {
    logger.error("Express consultation start error:", error);
    return NextResponse.json(
      { message: "Server error" },
      { status: 500 }
    );
  }
}

