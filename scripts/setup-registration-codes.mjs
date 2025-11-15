/* Скрипт для создания коллекции registration_codes в Directus
 *
 * Требуются переменные окружения:
 * - DIRECTUS_URL            — базовый URL Directus
 * - DIRECTUS_ADMIN_TOKEN    — админский static token ИЛИ
 * - DIRECTUS_ADMIN_EMAIL    — email админа
 * - DIRECTUS_ADMIN_PASSWORD — пароль админа
 *
 * Запуск:
 *   DIRECTUS_URL="..." DIRECTUS_ADMIN_TOKEN="..." node scripts/setup-registration-codes.mjs
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
  // Убираем пробелы и слеши в начале пути, добавляем слеш если нужно
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

async function ensureCollection(token, collectionName, fields) {
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
      icon: 'vpn_key',
      note: 'Коды регистрации для пользователей',
      display_template: '{{code}}',
      hidden: false,
      singleton: false,
      translations: null,
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
      on_delete: 'SET NULL',
    },
  });
  console.log(`  ✓ Связь ${field} создана`);
}

async function main() {
  console.log('🚀 Начинаю настройку коллекции registration_codes...\n');
  
  const token = await loginIfNeeded();
  console.log('✓ Авторизация успешна\n');

  // Создаем коллекцию
  await ensureCollection(token, 'registration_codes', []);

  // Создаем поля
  await ensureField(token, 'registration_codes', 'id', {
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

  await ensureField(token, 'registration_codes', 'code', {
    type: 'string',
    meta: {
      interface: 'input',
      required: true,
      readonly: false,
      note: 'Уникальный код для регистрации',
    },
    schema: {
      is_unique: true,
      is_nullable: false,
    },
  });

  await ensureField(token, 'registration_codes', 'used', {
    type: 'boolean',
    meta: {
      interface: 'boolean',
      required: false,
      readonly: false,
      note: 'Использован ли код',
    },
    schema: {
      default_value: false,
      is_nullable: false,
    },
  });

  await ensureField(token, 'registration_codes', 'used_by', {
    type: 'uuid',
    meta: {
      interface: 'select-dropdown-m2o',
      required: false,
      readonly: false,
      note: 'Пользователь, который использовал код',
    },
    schema: {
      is_nullable: true,
    },
  });

  await ensureField(token, 'registration_codes', 'used_at', {
    type: 'timestamp',
    meta: {
      interface: 'datetime',
      required: false,
      readonly: false,
      note: 'Дата и время использования кода',
    },
    schema: {
      is_nullable: true,
    },
  });

  await ensureField(token, 'registration_codes', 'expires_at', {
    type: 'timestamp',
    meta: {
      interface: 'datetime',
      required: false,
      readonly: false,
      note: 'Дата и время истечения кода',
    },
    schema: {
      is_nullable: true,
    },
  });

  await ensureField(token, 'registration_codes', 'max_uses', {
    type: 'integer',
    meta: {
      interface: 'input',
      required: false,
      readonly: false,
      note: 'Максимальное количество использований (null = неограничено)',
    },
    schema: {
      default_value: 1,
      is_nullable: true,
    },
  });

  await ensureField(token, 'registration_codes', 'use_count', {
    type: 'integer',
    meta: {
      interface: 'input',
      required: false,
      readonly: false,
      note: 'Текущее количество использований',
    },
    schema: {
      default_value: 0,
      is_nullable: false,
    },
  });

  await ensureField(token, 'registration_codes', 'created_by', {
    type: 'uuid',
    meta: {
      interface: 'select-dropdown-m2o',
      required: false,
      readonly: false,
      note: 'Кто создал код',
    },
    schema: {
      is_nullable: true,
    },
  });

  await ensureField(token, 'registration_codes', 'role', {
    type: 'string',
    meta: {
      interface: 'select-dropdown',
      required: false,
      readonly: false,
      note: 'Роль, которая будет присвоена пользователю при регистрации',
      options: {
        choices: [
          { text: 'Client', value: 'client' },
          { text: 'Master', value: 'master' },
        ],
      },
    },
    schema: {
      is_nullable: true,
    },
  });

  // Создаем связи
  await ensureM2O(token, {
    collection: 'registration_codes',
    field: 'used_by',
    related_collection: 'directus_users',
  });

  await ensureM2O(token, {
    collection: 'registration_codes',
    field: 'created_by',
    related_collection: 'directus_users',
  });

  console.log('\n✅ Настройка коллекции registration_codes завершена!');
  console.log('\n📝 Следующие шаги:');
  console.log('1. Создайте коды регистрации через админ-панель Directus или API');
  console.log('2. Настройте права доступа для роли, которая будет использоваться при регистрации');
}

main().catch((err) => {
  console.error('❌ Ошибка:', err);
  process.exit(1);
});

