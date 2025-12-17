/* Скрипт для настройки политик доступа в Directus
 *
 * Требуются переменные окружения:
 * - DIRECTUS_URL            — базовый URL Directus
 * - DIRECTUS_ADMIN_TOKEN    — админский static token ИЛИ
 * - DIRECTUS_ADMIN_EMAIL    — email админа
 * - DIRECTUS_ADMIN_PASSWORD — пароль админа
 *
 * Запуск:
 *   DIRECTUS_URL="https://directus.example.com" DIRECTUS_ADMIN_TOKEN="your_token" node scripts/setup-directus-permissions.mjs
 *
 * Что делает:
 * - Создаёт роль "master" (если не существует)
 * - Настраивает permissions для коллекций: clients, profiles, qa, profile_chunks, consultations, consultation_details
 * - Устанавливает фильтры по owner_user для изоляции данных пользователей
 * - Проверяет настройки токенов (AUTH_TOKEN_TTL, AUTH_REFRESH_TOKEN_TTL)
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

async function ensureRole(token, roleKey, roleName) {
  const roles = await getRoles(token);
  const existing = roles.find((r) => r.id === roleKey || r.name === roleName);
  if (existing) {
    console.log(`✔ Роль "${roleName}" уже существует (ID: ${existing.id})`);
    return existing.id;
  }
  
  const result = await api('/roles', 'POST', token, {
    id: roleKey,
    name: roleName,
    icon: 'verified',
    admin_access: false,
    app_access: true,
  });
  console.log(`✔ Создана роль "${roleName}" (ID: ${roleKey})`);
  return roleKey;
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
    // Обновляем существующее permission
    await api(`/permissions/${found.id}`, 'PATCH', token, permission);
    console.log(`  ✓ Обновлено: ${permission.collection}.${permission.action}`);
    return false;
  } else {
    // Создаём новое permission
    await api('/permissions', 'POST', token, permission);
    console.log(`  ✓ Создано: ${permission.collection}.${permission.action}`);
    return true;
  }
}

async function setupCollectionPermissions(token, roleId, collection, config) {
  const actions = ['create', 'read', 'update', 'delete'];
  const created = [];
  
  for (const action of actions) {
    const permission = {
      role: roleId,
      collection: collection,
      action: action,
      permissions: config.permissions || {},
      validation: config.validation || {},
      presets: config.presets || null,
      fields: config.fields || '*',
    };
    
    if (await setPermission(token, permission)) {
      created.push(action);
    }
  }
  
  return created;
}

async function checkTokenSettings(token) {
  console.log('\n📋 Проверка настроек токенов:');
  
  // К сожалению, Directus не предоставляет API для чтения AUTH_TOKEN_TTL
  // Но мы можем проверить токен, который получили
  try {
    const meRes = await fetch(`${DIRECTUS_URL}/users/me`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (meRes.ok) {
      const meData = await meRes.json();
      console.log('  ✓ Токен валиден');
      
      // Попробуем декодировать JWT (базовая проверка)
      const tokenParts = token.split('.');
      if (tokenParts.length === 3) {
        try {
          const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
          const now = Math.floor(Date.now() / 1000);
          const expiresIn = payload.exp - now;
          const expiresInDays = Math.floor(expiresIn / 86400);
          const expiresInHours = Math.floor((expiresIn % 86400) / 3600);
          const expiresInMinutes = Math.floor((expiresIn % 3600) / 60);
          
          console.log(`  ⏰ Токен истекает через: ${expiresInDays}д ${expiresInHours}ч ${expiresInMinutes}м`);
          
          if (expiresIn < 3600) {
            console.log('  ⚠️  ВНИМАНИЕ: Токен истекает менее чем через час!');
            console.log('     Установите в Directus: AUTH_TOKEN_TTL=259200 (3 дня)');
          } else if (expiresIn < 86400) {
            console.log('  ⚠️  ВНИМАНИЕ: Токен истекает менее чем через день!');
            console.log('     Установите в Directus: AUTH_TOKEN_TTL=259200 (3 дня)');
          } else {
            console.log('  ✓ Время жизни токена настроено правильно');
          }
        } catch (e) {
          console.log('  ⚠️  Не удалось декодировать токен');
        }
      }
    }
  } catch (error) {
    console.log('  ⚠️  Не удалось проверить токен:', error.message);
  }
  
  console.log('\n💡 Для изменения времени жизни токенов установите в Directus:');
  console.log('   AUTH_TOKEN_TTL=259200        # 3 дня для access token');
  console.log('   AUTH_REFRESH_TOKEN_TTL=2592000  # 30 дней для refresh token');
}

async function main() {
  console.log('🚀 Настройка политик доступа в Directus...\n');
  
  const token = await loginIfNeeded();
  console.log('✔ Получен токен доступа\n');

  // 1) Создаём роль "master"
  const masterRoleId = await ensureRole(token, 'master', 'Master');
  console.log('');

  // 2) Настраиваем permissions для коллекций
  
  console.log('📝 Настройка permissions для коллекции "clients":');
  await setupCollectionPermissions(token, masterRoleId, 'clients', {
    permissions: {
      // Пользователь видит только своих клиентов
      _and: [
        { owner_user: { _eq: '$CURRENT_USER' } }
      ]
    },
    validation: {
      // При создании автоматически проставляется owner_user
      owner_user: { _eq: '$CURRENT_USER' }
    },
    presets: {
      // Автоматически проставляем owner_user при создании
      owner_user: '$CURRENT_USER'
    },
    fields: 'id,name,birth_date,email,phone,source,communication_method,created_at,owner_user'
  });

  console.log('\n📝 Настройка permissions для коллекции "profiles":');
  await setupCollectionPermissions(token, masterRoleId, 'profiles', {
    permissions: {
      // Пользователь видит только профили своих клиентов
      _and: [
        { owner_user: { _eq: '$CURRENT_USER' } }
      ]
    },
    validation: {
      owner_user: { _eq: '$CURRENT_USER' }
    },
    presets: {
      owner_user: '$CURRENT_USER'
    },
    fields: '*'
  });

  console.log('\n📝 Настройка permissions для коллекции "qa":');
  await setupCollectionPermissions(token, masterRoleId, 'qa', {
    permissions: {
      // Пользователь видит только Q&A для своих профилей
      // Используем фильтр через связанную коллекцию profiles
      profile_id: {
        owner_user: { _eq: '$CURRENT_USER' }
      }
    },
    validation: {},
    presets: null,
    fields: '*'
  });

  console.log('\n📝 Настройка permissions для коллекции "profile_chunks":');
  await setupCollectionPermissions(token, masterRoleId, 'profile_chunks', {
    permissions: {
      // Пользователь видит только chunks своих профилей
      // Используем фильтр через связанную коллекцию profiles
      profile_id: {
        owner_user: { _eq: '$CURRENT_USER' }
      }
    },
    validation: {},
    presets: null,
    fields: '*'
  });

  console.log('\n📝 Настройка permissions для коллекции "consultations":');
  await setupCollectionPermissions(token, masterRoleId, 'consultations', {
    permissions: {
      // Пользователь видит только свои консультации
      _and: [
        { owner_user: { _eq: '$CURRENT_USER' } }
      ]
    },
    validation: {
      owner_user: { _eq: '$CURRENT_USER' }
    },
    presets: {
      owner_user: '$CURRENT_USER'
    },
    fields: '*'
  });

  console.log('\n📝 Настройка permissions для коллекции "consultation_details":');
  await setupCollectionPermissions(token, masterRoleId, 'consultation_details', {
    permissions: {
      // Пользователь видит только детали своих консультаций
      // Используем фильтр через связанную коллекцию consultations
      consultation_id: {
        owner_user: { _eq: '$CURRENT_USER' }
      }
    },
    validation: {},
    presets: null,
    fields: '*'
  });

  console.log('\n📝 Настройка permissions для коллекции "images_id":');
  await setupCollectionPermissions(token, masterRoleId, 'images_id', {
    permissions: {
      // Пользователь видит только изображения своих профилей
      // Предполагаем, что images_id связана с profiles через profile_id или owner_user
      // Если структура другая, нужно будет скорректировать
      _or: [
        { owner_user: { _eq: '$CURRENT_USER' } },
        {
          profile_id: {
            owner_user: { _eq: '$CURRENT_USER' }
          }
        }
      ]
    },
    validation: {},
    presets: {
      owner_user: '$CURRENT_USER'
    },
    fields: '*'
  });

  console.log('\n📝 Настройка permissions для коллекции "test_tokens":');
  await setupCollectionPermissions(token, masterRoleId, 'test_tokens', {
    permissions: {
      // Пользователь видит только токены для своих клиентов
      // Используем фильтр через связанную коллекцию clients
      client_id: {
        owner_user: { _eq: '$CURRENT_USER' }
      }
    },
    validation: {
      // Проверяем, что клиент принадлежит текущему пользователю
      client_id: {
        owner_user: { _eq: '$CURRENT_USER' }
      }
    },
    presets: null,
    fields: '*'
  });

  // 3) Проверяем настройки токенов
  await checkTokenSettings(token);

  console.log('\n✅ Настройка политик доступа завершена!');
  console.log('\n📌 Важно:');
  console.log('   - Убедитесь, что пользователи назначены на роль "master"');
  console.log('   - Проверьте, что в Directus установлены AUTH_TOKEN_TTL и AUTH_REFRESH_TOKEN_TTL');
  console.log('   - Перезапустите Directus после изменения переменных окружения');
  console.log('\n📋 Настроены permissions для коллекций:');
  console.log('   ✓ clients - только свои клиенты');
  console.log('   ✓ profiles - только свои профили');
  console.log('   ✓ qa - только Q&A для своих профилей');
  console.log('   ✓ profile_chunks - только chunks своих профилей');
  console.log('   ✓ consultations - только свои консультации');
  console.log('   ✓ consultation_details - только детали своих консультаций');
  console.log('   ✓ images_id - только изображения своих профилей');
  console.log('\n⚠️  Системные коллекции (directus_*) не настроены - они доступны только админам');
}

main().catch((e) => {
  console.error('\n❌ Ошибка:', e.message);
  if (e.stack) console.error(e.stack);
  process.exit(1);
});

