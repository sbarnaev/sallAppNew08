/* Скрипт для настройки прав доступа для коллекции test_tokens
 *
 * Требуются переменные окружения:
 * - DIRECTUS_URL            — базовый URL Directus
 * - DIRECTUS_ADMIN_TOKEN    — админский static token ИЛИ
 * - DIRECTUS_ADMIN_EMAIL    — email админа
 * - DIRECTUS_ADMIN_PASSWORD — пароль админа
 */

const DIRECTUS_URL = process.env.DIRECTUS_URL?.replace(/\/+$/, '');
const ADMIN_TOKEN = process.env.DIRECTUS_ADMIN_TOKEN;
const ADMIN_EMAIL = process.env.DIRECTUS_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.DIRECTUS_ADMIN_PASSWORD;

if (!DIRECTUS_URL) {
  console.error('❌ ERROR: Требуется DIRECTUS_URL');
  process.exit(1);
}
if (!ADMIN_TOKEN && !(ADMIN_EMAIL && ADMIN_PASSWORD)) {
  console.error('❌ ERROR: Укажите DIRECTUS_ADMIN_TOKEN или пару DIRECTUS_ADMIN_EMAIL / DIRECTUS_ADMIN_PASSWORD');
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

async function getRoles(token) {
  const json = await api('/roles?limit=-1', 'GET', token);
  return json.data ?? [];
}

async function getPermissions(token, roleId) {
  const json = await api(`/permissions?filter[role][_eq]=${roleId}&limit=-1`, 'GET', token);
  return json.data ?? [];
}

async function setPermission(token, permission) {
  const existing = await getPermissions(token, permission.role);
  const found = existing.find(
    (p) => p.collection === permission.collection && p.action === permission.action
  );
  
  if (found) {
    await api(`/permissions/${found.id}`, 'PATCH', token, permission);
    console.log(`  ✓ Обновлено: ${permission.collection}.${permission.action}`);
    return false;
  } else {
    await api('/permissions', 'POST', token, permission);
    console.log(`  ✓ Создано: ${permission.collection}.${permission.action}`);
    return true;
  }
}

async function main() {
  console.log('🚀 Настройка прав доступа для коллекции test_tokens...\n');
  
  const token = await loginIfNeeded();
  console.log('✔ Получен токен доступа\n');

  // Получаем роль master
  const roles = await getRoles(token);
  const masterRole = roles.find((r) => r.id === 'master' || r.name === 'Master');
  
  if (!masterRole) {
    console.error('❌ Роль "master" не найдена. Сначала создайте роль или укажите другую роль.');
    process.exit(1);
  }

  const masterRoleId = masterRole.id;
  console.log(`✔ Найдена роль "master" (ID: ${masterRoleId})\n`);

  // Настраиваем права для test_tokens
  console.log('📝 Настройка permissions для коллекции "test_tokens":');
  const actions = ['create', 'read', 'update', 'delete'];
  
  for (const action of actions) {
    const permission = {
      role: masterRoleId,
      collection: 'test_tokens',
      action: action,
      permissions: {
        client_id: {
          owner_user: { _eq: '$CURRENT_USER' }
        }
      },
      validation: action === 'create' ? {
        client_id: {
          owner_user: { _eq: '$CURRENT_USER' }
        }
      } : {},
      presets: null,
      fields: '*',
    };
    
    await setPermission(token, permission);
  }

  console.log('\n✅ Настройка прав доступа для test_tokens завершена!');
}

main().catch((e) => {
  console.error('\n❌ Ошибка:', e.message);
  if (e.stack) console.error(e.stack);
  process.exit(1);
});
