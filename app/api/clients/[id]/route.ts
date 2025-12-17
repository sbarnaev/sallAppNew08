import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDirectusUrl } from "@/lib/env";
import { checkSubscriptionInAPI } from "@/lib/subscription-check";

export async function GET(_req: Request, ctx: { params: { id: string }}) {
  // Проверяем подписку
  const subscriptionCheck = await checkSubscriptionInAPI();
  if (subscriptionCheck) {
    return subscriptionCheck;
  }

  const token = cookies().get("directus_access_token")?.value;
  const baseUrl = getDirectusUrl();
  if (!token || !baseUrl) return NextResponse.json({ data: null }, { status: 401 });
  const { id } = ctx.params;

  // Валидация ID
  if (!id || isNaN(Number(id)) || Number(id) <= 0) {
    return NextResponse.json({ data: null, message: "Invalid client ID" }, { status: 400 });
  }

  const url = `${baseUrl}/items/clients/${id}?fields=id,name,birth_date,email,phone,source,communication_method,notes,testirovanie,created_at,owner_user`;
  
  try {
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    });
    const data = await r.json().catch(()=>({ data: null }));
    return NextResponse.json(data, { status: r.status });
  } catch (error) {
    return NextResponse.json({ data: null, message: "Ошибка соединения с Directus", error: String(error) }, { status: 502 });
  }
}

export async function PATCH(req: Request, ctx: { params: { id: string }}) {
  // Проверяем подписку
  const subscriptionCheck = await checkSubscriptionInAPI();
  if (subscriptionCheck) {
    return subscriptionCheck;
  }

  const token = cookies().get("directus_access_token")?.value;
  const baseUrl = getDirectusUrl();
  if (!token || !baseUrl) return NextResponse.json({ message: "Unauthorized or no DIRECTUS_URL" }, { status: 401 });
  const { id } = ctx.params;

  const body = await req.json().catch(()=>({}));

  // Разрешённые поля для обновления
  const allowed: Record<string, any> = {};
  if (typeof body.name === "string") allowed.name = body.name.trim();
  if (body.birth_date !== undefined) allowed.birth_date = body.birth_date || null;
  if (body.phone !== undefined) allowed.phone = body.phone?.trim() || null;
  if (body.email !== undefined) allowed.email = body.email?.trim() || null;
  if (body.source !== undefined) allowed.source = body.source?.trim() || null;
  if (body.communication_method !== undefined) allowed.communication_method = body.communication_method?.trim() || null;
  if (body.notes !== undefined) allowed.notes = typeof body.notes === 'string' ? body.notes.trim() : body.notes;
  if (body.testirovanie !== undefined) allowed.testirovanie = body.testirovanie; // JSON объект

  const r = await fetch(`${baseUrl}/items/clients/${id}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(allowed),
  });
  const data = await r.json().catch(()=>({}));
  return NextResponse.json(data, { status: r.status });
}

export async function DELETE(req: Request, ctx: { params: { id: string }}) {
  // Проверяем подписку
  const subscriptionCheck = await checkSubscriptionInAPI();
  if (subscriptionCheck) {
    return subscriptionCheck;
  }

  const token = cookies().get("directus_access_token")?.value;
  const baseUrl = getDirectusUrl();
  if (!token || !baseUrl) return NextResponse.json({ message: "Unauthorized or no DIRECTUS_URL" }, { status: 401 });
  const { id } = ctx.params;
  
  // Валидация ID
  if (!id || isNaN(Number(id)) || Number(id) <= 0) {
    return NextResponse.json({ message: "Invalid client ID" }, { status: 400 });
  }

  const { confirm } = await req.json().catch(()=>({ confirm: false }));
  if (!confirm) return NextResponse.json({ message: "Deletion not confirmed" }, { status: 400 });

  async function safeJson(r: Response) {
    return r.json().catch(()=>({}));
  }

  async function authorizedFetch(url: string, init: RequestInit = {}) {
    const doFetch = async (tkn: string) => fetch(url, { ...init, headers: { ...(init.headers||{}), Authorization: `Bearer ${tkn}`, Accept: "application/json" }, cache: "no-store" });
    const initialToken = cookies().get("directus_access_token")?.value || token || "";
    let r = await doFetch(initialToken);
    if (r.status === 401) {
      try {
        const origin = new URL(req.url).origin;
        const refresh = await fetch(`${origin}/api/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }});
        if (refresh.ok) {
          const newToken = cookies().get("directus_access_token")?.value || token || "";
          r = await doFetch(newToken);
        }
      } catch {}
    }
    return r;
  }

  async function deleteByIds(collection: string, ids: number[]) {
    if (ids.length === 0) return { ok: true } as const;
    const batches: number[][] = [];
    for (let i = 0; i < ids.length; i += 100) batches.push(ids.slice(i, i + 100));
    for (const batch of batches) {
      const r = await authorizedFetch(`${baseUrl}/items/${collection}?ids=${batch.join(',')}`, { method: 'DELETE' });
      if (!r.ok && r.status !== 404) {
        const err = await r.json().catch(()=>({}));
        return { ok: false as const, status: r.status, err };
      }
    }
    return { ok: true } as const;
  }

  try {
    // 1) Найти консультации клиента
    const consListRes = await authorizedFetch(`${baseUrl}/items/consultations?filter[client_id][_eq]=${id}&fields=id&limit=5000`);
    const consList = await safeJson(consListRes);
    const consultationIds: number[] = Array.isArray(consList?.data) ? consList.data.map((x: any)=>x.id) : [];

    // 1.1) Удалить детали консультаций, если есть
    if (consultationIds.length > 0) {
      const idsStr = consultationIds.join(',');
      // Получить детали
      const detListRes = await authorizedFetch(`${baseUrl}/items/consultation_details?filter[consultation_id][_in]=${idsStr}&fields=id&limit=5000`);
      const detList = await safeJson(detListRes);
      const detailIds: number[] = Array.isArray(detList?.data) ? detList.data.map((x: any)=>x.id) : [];
      if (detailIds.length > 0) {
        const delDet = await deleteByIds('consultation_details', detailIds);
        if (!delDet.ok) return NextResponse.json(delDet.err || { message: 'Failed to delete consultation_details' }, { status: delDet.status || 500 });
      }
      const delCons = await deleteByIds('consultations', consultationIds);
      if (!delCons.ok) return NextResponse.json(delCons.err || { message: 'Failed to delete consultations' }, { status: delCons.status || 500 });
    }

    // 2) Найти профили клиента
    const profListRes = await authorizedFetch(`${baseUrl}/items/profiles?filter[client_id][_eq]=${id}&fields=id&limit=5000`);
    const profList = await safeJson(profListRes);
    const profileIds: number[] = Array.isArray(profList?.data) ? profList.data.map((x: any)=>x.id) : [];

    // 2.1) Попробовать удалить QA, если коллекция существует (best-effort)
    if (profileIds.length > 0) {
      const idsStr = profileIds.join(',');
      try {
        const qaListRes = await authorizedFetch(`${baseUrl}/items/qa?filter[profile_id][_in]=${idsStr}&fields=id&limit=5000`);
        if (qaListRes.ok) {
          const qaList = await safeJson(qaListRes);
          const qaIds: number[] = Array.isArray(qaList?.data) ? qaList.data.map((x: any)=>x.id) : [];
          if (qaIds.length > 0) {
            await deleteByIds('qa', qaIds);
          }
        }
      } catch {}

      // Удалить связанные таблицы, если существуют (best-effort)
      try {
        const chunksRes = await authorizedFetch(`${baseUrl}/items/profile_chunks?filter[profile_id][_in]=${idsStr}&fields=id&limit=5000`);
        if (chunksRes.ok) {
          const chunks = await safeJson(chunksRes);
          const chunkIds: number[] = Array.isArray(chunks?.data) ? chunks.data.map((x: any)=>x.id) : [];
          if (chunkIds.length > 0) await deleteByIds('profile_chunks', chunkIds);
        }
      } catch {}

      // Удалить профили
      const delProf = await deleteByIds('profiles', profileIds);
      if (!delProf.ok) return NextResponse.json(delProf.err || { message: 'Failed to delete profiles' }, { status: delProf.status || 500 });
    }

    // 2.2) Удалить test_tokens для клиента (best-effort)
    try {
      const tokensRes = await authorizedFetch(`${baseUrl}/items/test_tokens?filter[client_id][_eq]=${id}&fields=id&limit=5000`);
      if (tokensRes.ok) {
        const tokens = await safeJson(tokensRes);
        const tokenIds: number[] = Array.isArray(tokens?.data) ? tokens.data.map((x: any)=>x.id) : [];
        if (tokenIds.length > 0) {
          await deleteByIds('test_tokens', tokenIds);
        }
      }
    } catch {}

    // 3) Удалить клиента
    const r = await authorizedFetch(`${baseUrl}/items/clients/${id}`, { method: 'DELETE' });
    if (!r.ok) {
      const err = await safeJson(r);
      return NextResponse.json(err || { message: 'Delete failed' }, { status: r.status });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ message: 'Delete failed', error: String(error) }, { status: 500 });
  }
}

 