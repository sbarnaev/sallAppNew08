/* Idempotent Directus bootstrap script
 *
 * Требуются переменные окружения:
 * - DIRECTUS_URL            — базовый URL Directus (например, https://directus.example.com)
 * - DIRECTUS_ADMIN_TOKEN    — админский static token ИЛИ
 * - DIRECTUS_ADMIN_EMAIL    — email админа
 * - DIRECTUS_ADMIN_PASSWORD — пароль админа
 *
 * Запуск:
 *   npm run setup:directus
 *
 * Что делает:
 * - Создаёт коллекции: clients, profiles, profile_chunks, qa
 * - Добавляет ключевые поля (ui_state, notes, chat_history и связи profile_id/client_id)
 * - Создаёт связи M2O для profile_id и client_id
 * - Добавляет поле users.contact (string)
 *
 * Скрипт безопасно перезапускается (idempotent): пропускает уже существующее.
 */

const DIRECTUS_URL = process.env.DIRECTUS_URL?.replace(/\/+$/, '');
const ADMIN_TOKEN = process.env.DIRECTUS_ADMIN_TOKEN;
const ADMIN_EMAIL = process.env.DIRECTUS_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.DIRECTUS_ADMIN_PASSWORD;

if (!DIRECTUS_URL) {
  console.error('ERROR: Требуется DIRECTUS_URL');
  process.exit(1);
}
if (!ADMIN_TOKEN && !(ADMIN_EMAIL && ADMIN_PASSWORD)) {
  console.error('ERROR: Укажите DIRECTUS_ADMIN_TOKEN или пару DIRECTUS_ADMIN_EMAIL / DIRECTUS_ADMIN_PASSWORD');
  process.exit(1);
}

async function loginIfNeeded() {
  if (ADMIN_TOKEN) return ADMIN_TOKEN;
  const res = await fetch(`${DIRECTUS_URL}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Login failed: ${res.status} ${res.statusText} ${text}`);
  }
  const data = await res.json();
  return data?.data?.access_token;
}

async function api(path, method = 'GET', token, body) {
  const res = await fetch(`${DIRECTUS_URL}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${method} ${path} failed: ${res.status} ${res.statusText} ${text}`);
  }
  return res.json();
}

async function getCollections(token) {
  const json = await api('/collections?limit=-1', 'GET', token);
  return json.data ?? [];
}

async function ensureCollection(token, collection, payload) {
  const existing = await getCollections(token);
  const found = existing.find((c) => c.collection === collection);
  if (found) return false;
  await api('/collections', 'POST', token, {
    collection,
    meta: {
      collection,
      icon: payload.icon ?? 'box',
      note: payload.note ?? null,
      singleton: false,
    },
    schema: {
      name: collection,
      comment: payload.comment ?? null,
    },
  });
  return true;
}

async function getFields(token, collection) {
  const json = await api(`/fields/${collection}?limit=-1`, 'GET', token);
  return json.data ?? [];
}

async function ensureField(token, collection, fieldConfig) {
  const fields = await getFields(token, collection);
  const exists = fields.some((f) => f.field === fieldConfig.field);
  if (exists) return false;
  await api(`/fields/${collection}`, 'POST', token, {
    collection,
    ...fieldConfig,
  });
  return true;
}

async function getRelations(token) {
  const json = await api('/relations?limit=-1', 'GET', token);
  return json.data ?? [];
}

async function ensureM2O(token, { collection, field, related_collection }) {
  const relations = await getRelations(token);
  const exists = relations.some(
    (r) =>
      r.collection === collection &&
      r.field === field &&
      r.related_collection === related_collection &&
      r.type === 'm2o'
  );
  if (exists) return false;
  await api('/relations', 'POST', token, {
    collection,
    field,
    related_collection,
    meta: { many_collection: collection, many_field: field, one_collection: related_collection },
    schema: {
      on_update: 'NO ACTION',
      on_delete: 'SET NULL',
      // Directus создаст внешний ключ автоматически
    },
    type: 'm2o',
  });
  return true;
}

async function main() {
  const token = await loginIfNeeded();
  console.log('✔ Получен токен');

  // 1) collections
  const created = [];
  if (await ensureCollection(token, 'clients', { icon: 'users' })) created.push('clients');
  if (await ensureCollection(token, 'profiles', { icon: 'file_text' })) created.push('profiles');
  if (await ensureCollection(token, 'profile_chunks', { icon: 'segment' })) created.push('profile_chunks');
  if (await ensureCollection(token, 'qa', { icon: 'question_answer' })) created.push('qa');
  if (created.length) console.log('✔ Созданы коллекции:', created.join(', '));

  // 2) essential fields
  const ensure = async (fn, label) => {
    if (await fn()) console.log(`✔ Добавлено поле: ${label}`);
  };

  // clients: name (string)
  await ensure(
    () => ensureField(token, 'clients', { field: 'name', type: 'string', meta: { interface: 'input', width: 'full' } }),
    'clients.name'
  );

  // profiles: client_id (int, M2O), ui_state (json), notes (text), chat_history (json), raw_html (text, optional)
  await ensure(
    () => ensureField(token, 'profiles', { field: 'client_id', type: 'integer', meta: { interface: 'select-dropdown-m2o', width: 'full' } }),
    'profiles.client_id'
  );
  await ensure(
    () => ensureField(token, 'profiles', { field: 'ui_state', type: 'json', meta: { interface: 'input-code', options: { language: 'json' }, width: 'full' } }),
    'profiles.ui_state'
  );
  await ensure(
    () => ensureField(token, 'profiles', { field: 'notes', type: 'text', meta: { interface: 'input-rich-text-md', width: 'full' } }),
    'profiles.notes'
  );
  await ensure(
    () => ensureField(token, 'profiles', { field: 'chat_history', type: 'json', meta: { interface: 'input-code', options: { language: 'json' }, width: 'full' } }),
    'profiles.chat_history'
  );
  await ensure(
    () => ensureField(token, 'profiles', { field: 'raw_html', type: 'text', meta: { interface: 'input', width: 'full' } }),
    'profiles.raw_html'
  );

  // profile_chunks: profile_id (int, M2O), content (text)
  await ensure(
    () => ensureField(token, 'profile_chunks', { field: 'profile_id', type: 'integer', meta: { interface: 'select-dropdown-m2o', width: 'full' } }),
    'profile_chunks.profile_id'
  );
  await ensure(
    () => ensureField(token, 'profile_chunks', { field: 'content', type: 'text', meta: { interface: 'input', width: 'full' } }),
    'profile_chunks.content'
  );

  // qa: profile_id (int, M2O), question (text), answer (text), created_at (datetime)
  await ensure(
    () => ensureField(token, 'qa', { field: 'profile_id', type: 'integer', meta: { interface: 'select-dropdown-m2o', width: 'full' } }),
    'qa.profile_id'
  );
  await ensure(
    () => ensureField(token, 'qa', { field: 'question', type: 'text', meta: { interface: 'input', width: 'full' } }),
    'qa.question'
  );
  await ensure(
    () => ensureField(token, 'qa', { field: 'answer', type: 'text', meta: { interface: 'input', width: 'full' } }),
    'qa.answer'
  );
  await ensure(
    () => ensureField(token, 'qa', { field: 'created_at', type: 'timestamp', meta: { interface: 'datetime', width: 'full' } }),
    'qa.created_at'
  );

  // 3) relations (M2O)
  const relDone = [];
  if (await ensureM2O(token, { collection: 'profiles', field: 'client_id', related_collection: 'clients' })) relDone.push('profiles.client_id -> clients');
  if (await ensureM2O(token, { collection: 'profile_chunks', field: 'profile_id', related_collection: 'profiles' })) relDone.push('profile_chunks.profile_id -> profiles');
  if (await ensureM2O(token, { collection: 'qa', field: 'profile_id', related_collection: 'profiles' })) relDone.push('qa.profile_id -> profiles');
  if (relDone.length) console.log('✔ Созданы связи:', relDone.join(' | '));

  // 4) users.contact (string)
  await ensure(
    () => ensureField(token, 'users', { field: 'contact', type: 'string', meta: { interface: 'input', width: 'full' } }),
    'users.contact'
  );

  console.log('✅ Directus структура готова.');
}

// Node 18+ global fetch available
main().catch((e) => {
  console.error('Setup failed:', e.message);
  process.exit(1);
});


