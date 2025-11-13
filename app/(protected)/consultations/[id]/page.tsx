import Link from "next/link";
import { internalApiFetch } from "@/lib/fetchers";

async function getConsultation(id: string) {
  const res = await internalApiFetch(`/api/consultations/${id}`);
  const json = await res.json().catch(() => ({}));
  return json?.data || null;
}

async function getDetails(id: string) {
  const res = await internalApiFetch(`/api/consultations/${id}/details`);
  const json = await res.json().catch(() => ({ data: [] }));
  return json?.data || [];
}

export default async function ConsultationDetailPage({ params }: { params: { id: string } }) {
  const c = await getConsultation(params.id);
  const details = await getDetails(params.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Консультация #{params.id}</h1>
          <div className="text-sm text-gray-500">
            {c?.scheduled_at ? new Date(c.scheduled_at).toLocaleString() : "Без даты"} · {c?.type === 'partner' ? '👥 Парная' : c?.type || ""} · {c?.status || ""}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {c?.client_id && <Link href={`/clients/${c.client_id}`} className="px-3 py-2 rounded-lg border">Клиент #{c.client_id}</Link>}
          {c?.partner_client_id && <Link href={`/clients/${c.partner_client_id}`} className="px-3 py-2 rounded-lg border">Партнёр #{c.partner_client_id}</Link>}
          {c?.profile_id && <Link href={`/profiles/${c.profile_id}`} className="px-3 py-2 rounded-lg border">Профиль #{c.profile_id}</Link>}
          {c?.partner_profile_id && <Link href={`/profiles/${c.partner_profile_id}`} className="px-3 py-2 rounded-lg border">Профиль партнёра #{c.partner_profile_id}</Link>}
        </div>
      </div>

      <div className="grid gap-4">
        {details.length === 0 && <div className="card">Нет деталей</div>}
        {details.map((d: any) => (
          <div key={d.id} className="card">
            <div className="font-medium mb-2">{d.section}</div>
            <div className="text-sm whitespace-pre-wrap">{d.content}</div>
          </div>
        ))}
      </div>
    </div>
  );
} 