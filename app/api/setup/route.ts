import { NextRequest, NextResponse } from "next/server";
import { getDirectusUrl } from "@/lib/env";

/**
 * API endpoint для одноразовой инициализации Directus permissions
 * Вызывается один раз при деплое или вручную через админский токен
 * 
 * Использование:
 * POST /api/setup
 * Headers: X-Setup-Token: <ADMIN_TOKEN>
 * Body: { "force": false } // force=true для перезаписи существующих permissions
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function setupDirectusPermissions(token: string, force: boolean = false) {
  const baseUrl = getDirectusUrl();
  if (!baseUrl) {
    throw new Error("DIRECTUS_URL is not set");
  }

  const results: string[] = [];

  // 1) Создаём роль "master"
  try {
    const rolesRes = await fetch(`${baseUrl}/roles?limit=-1`, {
      headers: { authorization: `Bearer ${token}` },
    });
    const rolesData = await rolesRes.json().catch(() => ({ data: [] }));
    const existingRole = rolesData.data?.find((r: any) => r.id === 'master' || r.name === 'Master');
    
    if (!existingRole) {
      await fetch(`${baseUrl}/roles`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          id: 'master',
          name: 'Master',
          icon: 'verified',
          admin_access: false,
          app_access: true,
        }),
      });
      results.push('Создана роль "master"');
    } else {
      results.push('Роль "master" уже существует');
    }
  } catch (error: any) {
    throw new Error(`Ошибка создания роли: ${error.message}`);
  }

  // 2) Настраиваем permissions для коллекций
  const collections = [
    {
      name: 'clients',
      permissions: {
        _and: [{ owner_user: { _eq: '$CURRENT_USER' } }]
      },
      validation: { owner_user: { _eq: '$CURRENT_USER' } },
      presets: { owner_user: '$CURRENT_USER' },
      fields: 'id,name,birth_date,email,phone,source,communication_method,created_at,owner_user'
    },
    {
      name: 'profiles',
      permissions: {
        _and: [{ owner_user: { _eq: '$CURRENT_USER' } }]
      },
      validation: { owner_user: { _eq: '$CURRENT_USER' } },
      presets: { owner_user: '$CURRENT_USER' },
      fields: '*'
    },
    {
      name: 'qa',
      permissions: {
        profile_id: { owner_user: { _eq: '$CURRENT_USER' } }
      },
      validation: {},
      presets: null,
      fields: '*'
    },
    {
      name: 'profile_chunks',
      permissions: {
        profile_id: { owner_user: { _eq: '$CURRENT_USER' } }
      },
      validation: {},
      presets: null,
      fields: '*'
    },
    {
      name: 'consultations',
      permissions: {
        _and: [{ owner_user: { _eq: '$CURRENT_USER' } }]
      },
      validation: { owner_user: { _eq: '$CURRENT_USER' } },
      presets: { owner_user: '$CURRENT_USER' },
      fields: '*'
    },
    {
      name: 'consultation_details',
      permissions: {
        consultation_id: { owner_user: { _eq: '$CURRENT_USER' } }
      },
      validation: {},
      presets: null,
      fields: '*'
    },
    {
      name: 'images_id',
      permissions: {
        _or: [
          { owner_user: { _eq: '$CURRENT_USER' } },
          { profile_id: { owner_user: { _eq: '$CURRENT_USER' } } }
        ]
      },
      validation: {},
      presets: { owner_user: '$CURRENT_USER' },
      fields: '*'
    }
  ];

  for (const collection of collections) {
    const actions = ['create', 'read', 'update', 'delete'];
    
    for (const action of actions) {
      try {
        // Проверяем существующие permissions
        const existingRes = await fetch(
          `${baseUrl}/permissions?filter[role][_eq]=master&filter[collection][_eq]=${collection.name}&filter[action][_eq]=${action}`,
          { headers: { authorization: `Bearer ${token}` } }
        );
        const existingData = await existingRes.json().catch(() => ({ data: [] }));
        const existing = existingData.data?.[0];

        const permission = {
          role: 'master',
          collection: collection.name,
          action: action,
          permissions: collection.permissions,
          validation: collection.validation,
          presets: collection.presets,
          fields: collection.fields,
        };

        if (existing && force) {
          // Обновляем существующее
          await fetch(`${baseUrl}/permissions/${existing.id}`, {
            method: 'PATCH',
            headers: {
              authorization: `Bearer ${token}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify(permission),
          });
          results.push(`Обновлено: ${collection.name}.${action}`);
        } else if (!existing) {
          // Создаём новое
          await fetch(`${baseUrl}/permissions`, {
            method: 'POST',
            headers: {
              authorization: `Bearer ${token}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify(permission),
          });
          results.push(`Создано: ${collection.name}.${action}`);
        } else {
          results.push(`Пропущено: ${collection.name}.${action} (уже существует)`);
        }
      } catch (error: any) {
        results.push(`Ошибка ${collection.name}.${action}: ${error.message}`);
      }
    }
  }

  return results;
}

export async function POST(req: NextRequest) {
  // Проверяем токен из заголовка
  const setupToken = req.headers.get('X-Setup-Token');
  const adminToken = process.env.DIRECTUS_ADMIN_TOKEN || setupToken;
  
  if (!adminToken) {
    return NextResponse.json(
      { error: 'Требуется X-Setup-Token заголовок или DIRECTUS_ADMIN_TOKEN в env' },
      { status: 401 }
    );
  }

  // Проверяем, что это не публичный доступ (дополнительная защита)
  const authHeader = req.headers.get('authorization');
  if (!authHeader && !setupToken) {
    return NextResponse.json(
      { error: 'Неавторизованный доступ' },
      { status: 401 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const force = body.force === true;

    const results = await setupDirectusPermissions(adminToken, force);

    return NextResponse.json({
      success: true,
      message: 'Настройка permissions завершена',
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message, success: false },
      { status: 500 }
    );
  }
}

