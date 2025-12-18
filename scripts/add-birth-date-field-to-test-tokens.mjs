#!/usr/bin/env node

/**
 * Скрипт для добавления поля request_birth_date в коллекцию test_tokens
 * 
 * Использование:
 * DIRECTUS_URL="https://..." DIRECTUS_ADMIN_TOKEN="..." node scripts/add-birth-date-field-to-test-tokens.mjs
 */

const DIRECTUS_URL = process.env.DIRECTUS_URL;
const DIRECTUS_ADMIN_TOKEN = process.env.DIRECTUS_ADMIN_TOKEN;

if (!DIRECTUS_URL || !DIRECTUS_ADMIN_TOKEN) {
  console.error('❌ Требуются переменные окружения: DIRECTUS_URL и DIRECTUS_ADMIN_TOKEN');
  process.exit(1);
}

async function ensureField(collection, field, fieldConfig) {
  const url = `${DIRECTUS_URL}/fields/${collection}/${field}`;
  
  try {
    // Пытаемся получить поле
    const getRes = await fetch(url, {
      headers: {
        Authorization: `Bearer ${DIRECTUS_ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (getRes.ok) {
      console.log(`✓ Поле ${collection}.${field} уже существует`);
      return;
    }

    // Поле не существует, создаем
    const createRes = await fetch(`${DIRECTUS_URL}/fields/${collection}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${DIRECTUS_ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        field,
        ...fieldConfig
      })
    });

    if (createRes.ok) {
      console.log(`✓ Поле ${collection}.${field} успешно создано`);
    } else {
      const error = await createRes.json().catch(() => ({}));
      console.error(`❌ Ошибка создания поля ${collection}.${field}:`, error);
      throw new Error(`Failed to create field: ${JSON.stringify(error)}`);
    }
  } catch (error) {
    console.error(`❌ Ошибка при работе с полем ${collection}.${field}:`, error);
    throw error;
  }
}

async function main() {
  console.log('🚀 Добавление поля request_birth_date в коллекцию test_tokens...\n');

  try {
    await ensureField('test_tokens', 'request_birth_date', {
      type: 'boolean',
      meta: {
        interface: 'boolean',
        required: false,
        readonly: false,
        note: 'Запрашивать ли имя и дату рождения у клиента перед завершением теста',
        width: 'full'
      },
      schema: {
        default_value: false,
        is_nullable: false
      }
    });

    console.log('\n✅ Настройка завершена!');
    console.log('\n📝 Следующие шаги:');
    console.log('1. Проверьте права доступа для поля request_birth_date');
    console.log('2. Обновите код API для использования нового поля');
  } catch (error) {
    console.error('\n❌ Ошибка:', error);
    process.exit(1);
  }
}

main();
