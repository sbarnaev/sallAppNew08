/* Скрипт для создания коллекции test_tokens в Directus
 *
 * Требуются переменные окружения:
 * - DIRECTUS_URL            — базовый URL Directus
 * - DIRECTUS_ADMIN_TOKEN    — админский static token ИЛИ
 * - DIRECTUS_ADMIN_EMAIL    — email админа
 * - DIRECTUS_ADMIN_PASSWORD — пароль админа
 *
 * Запуск:
 *   DIRECTUS_URL="..." DIRECTUS_ADMIN_TOKEN="..." node scripts/setup-test-tokens.mjs
 */

const DIRECTUS_URL = process.env.DIRECTUS_URL?.trim().replace(/\/+$/, '') || '';
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
  const cleanUrl = DIRECTUS_URL.trim().replace(/\/+$/, '');
  const loginUrl = `${cleanUrl}/auth/login`;
  const res = await fetch(loginUrl, {
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
  const cleanPath = path.trim().replace(/^\/+/, '');
  const cleanUrl = DIRECTUS_URL.trim().replace(/\/+$/, '');
  const fullUrl = `${cleanUrl}/${cleanPath}`;
  
  const res = await fetch(fullUrl, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${method} ${fullUrl} failed: ${res.status} ${res.statusText} ${text}`);
  }
  return res.json();
}

async function ensureCollection(token, collectionName, meta) {
  try {
    const existing = await api(`/collections/${collectionName}`, 'GET', token).catch(() => null);
    if (existing) {
      console.log(`✓ Коллекция ${collectionName} уже существует`);
      return;
    }
  } catch {}

  console.log(`Создаю коллекцию ${collectionName}...`);
  await api('/collections', 'POST', token, {
    collection: collectionName,
    meta: {
      collection: collectionName,
      icon: 'link',
      note: 'Токены для одноразовых ссылок на психологические тесты',
      display_template: '{{token}}',
      hidden: false,
      singleton: false,
      translations: null,
      ...meta,
    },
    schema: {
      name: collectionName,
    },
  });
  console.log(`✓ Коллекция ${collectionName} создана`);
}

async function ensureField(token, collection, fieldName, fieldConfig) {
  try {
    const existing = await api(`/fields/${collection}/${fieldName}`, 'GET', token).catch(() => null);
    if (existing) {
      console.log(`  ✓ Поле ${fieldName} уже существует`);
      return;
    }
  } catch {}

  console.log(`  Создаю поле ${fieldName}...`);
  await api(`/fields/${collection}`, 'POST', token, {
    field: fieldName,
    ...fieldConfig,
  });
  console.log(`  ✓ Поле ${fieldName} создано`);
}

async function ensureM2O(token, { collection, field, related_collection }) {
  try {
    const existing = await api(`/relations/${collection}/${field}`, 'GET', token).catch(() => null);
    if (existing) {
      console.log(`  ✓ Связь ${field} уже существует`);
      return;
    }
  } catch {}

  console.log(`  Создаю связь ${field}...`);
  await api('/relations', 'POST', token, {
    collection,
    field,
    related_collection,
    schema: {
      on_delete: 'CASCADE',
    },
  });
  console.log(`  ✓ Связь ${field} создана`);
}

async function main() {
  console.log('🚀 Начинаю настройку коллекции test_tokens...\n');
  
  const token = await loginIfNeeded();
  console.log('✓ Авторизация успешна\n');

  // Создаем коллекцию
  await ensureCollection(token, 'test_tokens', {});

  // Создаем поля
  await ensureField(token, 'test_tokens', 'id', {
    type: 'uuid',
    meta: {
      interface: 'input',
      readonly: true,
      hidden: true,
    },
    schema: {
      is_primary_key: true,
    },
  });

  await ensureField(token, 'test_tokens', 'token', {
    type: 'uuid',
    meta: {
      interface: 'input',
      required: true,
      readonly: false,
      note: 'Уникальный токен для ссылки на тест',
    },
    schema: {
      is_unique: true,
      is_nullable: false,
    },
  });

  await ensureField(token, 'test_tokens', 'client_id', {
    type: 'integer',
    meta: {
      interface: 'select-dropdown-m2o',
      required: true,
      readonly: false,
      note: 'Клиент, для которого создана ссылка',
    },
    schema: {
      is_nullable: false,
    },
  });

  await ensureField(token, 'test_tokens', 'test_id', {
    type: 'string',
    meta: {
      interface: 'input',
      required: true,
      readonly: false,
      note: 'ID теста (например: depression, anxiety, etc.)',
    },
    schema: {
      is_nullable: false,
    },
  });

  await ensureField(token, 'test_tokens', 'used', {
    type: 'boolean',
    meta: {
      interface: 'boolean',
      required: false,
      readonly: false,
      note: 'Использован ли токен',
    },
    schema: {
      default_value: false,
      is_nullable: false,
    },
  });

  await ensureField(token, 'test_tokens', 'expires_at', {
    type: 'timestamp',
    meta: {
      interface: 'datetime',
      required: false,
      readonly: false,
      note: 'Дата и время истечения токена (null = без ограничения)',
    },
    schema: {
      is_nullable: true,
    },
  });

  await ensureField(token, 'test_tokens', 'created_at', {
    type: 'timestamp',
    meta: {
      interface: 'datetime',
      required: false,
      readonly: true,
      note: 'Дата и время создания токена',
    },
    schema: {
      is_nullable: false,
      default_value: 'NOW()',
    },
  });

  // Создаем связи
  await ensureM2O(token, {
    collection: 'test_tokens',
    field: 'client_id',
    related_collection: 'clients',
  });

  console.log('\n✅ Настройка коллекции test_tokens завершена!');
  console.log('\n📝 Следующие шаги:');
  console.log('1. Настройте права доступа для коллекции test_tokens');
  console.log('2. Используйте API /api/tests/generate-link для создания ссылок');
}

main().catch((err) => {
  console.error('❌ Ошибка:', err);
  process.exit(1);
});
