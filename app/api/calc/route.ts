import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDirectusUrl } from "@/lib/env";

function generatePublicCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // без 0/O/1/I
  const len = 5 + Math.floor(Math.random() * 3); // 5-7
  let out = "";
  for (let i = 0; i < len; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export async function POST(req: Request) {
  const token = cookies().get("directus_access_token")?.value;
  const directusUrl = getDirectusUrl();
  const n8nUrl = process.env.N8N_CALC_URL;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!n8nUrl) return NextResponse.json({ message: "No N8N_CALC_URL configured" }, { status: 400 });

  let payload: any = {};
  try {
    payload = await req.json();
  } catch {
    payload = {};
  }

  const { clientId, name, birthday, type, request, clientRequest, query, prompt } = payload || {};
  const publicCode = generatePublicCode();

  // 1) Пытаемся создать пустой профиль в Directus, чтобы получить profileId для дальнейшего поллинга
  let profileId: number | null = null;
  if (directusUrl) {
    try {
      // Получим текущего пользователя, чтобы проставить owner_user
      let ownerUserId: string | null = null;
      try {
        const meRes = await fetch(`${directusUrl}/users/me`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
          cache: "no-store",
        });
        if (meRes.ok) {
          const me = await meRes.json().catch(()=>({}));
          ownerUserId = me?.data?.id || null;
        }
      } catch {}

      const createRes = await fetch(`${directusUrl}/items/profiles`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ 
          client_id: clientId ? Number(clientId) : null,
          ...(ownerUserId ? { owner_user: ownerUserId } : {}),
        }),
      });
      const createData = await createRes.json().catch(() => ({}));
      if (createRes.ok && createData?.data?.id) {
        profileId = Number(createData.data.id);
      }
    } catch {
      // игнорируем — fallback ниже
    }
  }

  // 1.1) Best-effort: попробуем записать public_code в профиль, если поле существует
  if (directusUrl && profileId) {
    try {
      await fetch(`${directusUrl}/items/profiles/${profileId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ public_code: publicCode }),
      }).catch(() => {});
    } catch {}
  }

  // 2) Вызываем n8n, передаём profileId (если удалось создать) и publicCode
  let r: Response;
  let data: any = null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    r = await fetch(n8nUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name,
        birthday,
        clientId,
        type: type || "base",
        profileId, // важно для последующего обновления профиля n8n
        public_code: publicCode,
        // Дополнительный запрос пользователя (для целевого расчёта)
        request: request ?? clientRequest ?? query ?? prompt ?? null,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    data = await r.json().catch(() => ({}));
  } catch (error) {
    return NextResponse.json({ message: "Cannot connect to n8n", error: String(error) }, { status: 502 });
  }

  if (!r.ok) {
    const msg = data?.message || data?.error || "Calculation failed";
    return NextResponse.json({ ...data, message: msg }, { status: r.status });
  }

  // 3) Гарантируем возврат profileId + publicCode для мгновенного редиректа и отображения
  const returnedId =
    profileId || data?.profileId || data?.data?.profileId || data?.id || data?.data?.id || null;

  if (returnedId) {
    return NextResponse.json({ profileId: Number(returnedId), public_code: publicCode });
  }

  // Fallback: если id так и нет, возвращаем как есть (клиентская логика отправит на список)
  return NextResponse.json({ ...data, public_code: publicCode });
}
