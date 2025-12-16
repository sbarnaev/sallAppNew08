"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface SubscriptionInfo {
  expiresAt: string | null;
  hasAccess: boolean;
  daysRemaining: number | null;
  hoursRemaining?: number | null;
  minutesRemaining?: number | null;
}

export function SubscriptionStatus() {
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Логируем, что компонент загрузился
  useEffect(() => {
    console.log("[SubscriptionStatus] Component mounted and rendered");
  }, []);

  useEffect(() => {
    async function loadSubscription() {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        
        // Если получили 403 - доступ истёк, перенаправляем
        if (res.status === 403) {
          window.location.href = "/subscription-expired";
          return;
        }
        
        const data = await res.json().catch(() => ({ data: null }));
        
        // Логируем для отладки
        console.log("[SubscriptionStatus] API response:", {
          status: res.status,
          hasData: !!data?.data,
          hasSubscription: !!data?.data?.subscription,
          subscription: data?.data?.subscription,
          fullData: data
        });
        
        if (data?.data?.subscription) {
          const sub = data.data.subscription;
          
          // Вычисляем точное время до окончания
          if (sub.expiresAt) {
            const expiresDate = new Date(sub.expiresAt);
            const now = new Date();
            const diff = expiresDate.getTime() - now.getTime();
            
            if (diff > 0) {
              const hours = Math.floor(diff / (1000 * 60 * 60));
              const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
              sub.hoursRemaining = hours;
              sub.minutesRemaining = minutes;
            } else {
              sub.hoursRemaining = 0;
              sub.minutesRemaining = 0;
            }
          }
          
          setSubscription(sub);
        } else {
          // Если нет данных о подписке, но есть data.data - создаем объект подписки
          if (data?.data) {
            console.warn("[SubscriptionStatus] No subscription data in response, but user data exists:", data.data);
            // Создаем объект подписки с null значениями
            setSubscription({
              expiresAt: null,
              hasAccess: true,
              daysRemaining: null
            });
          } else {
            console.error("[SubscriptionStatus] No data in API response");
            setSubscription(null);
          }
        }
      } catch (error) {
        console.error("[SubscriptionStatus] Error loading subscription:", error);
        setError(error instanceof Error ? error.message : String(error));
      } finally {
        setLoading(false);
      }
    }

    loadSubscription();
    
    // Проверяем доступ каждые 5 минут
    const interval = setInterval(() => {
      loadSubscription();
    }, 5 * 60 * 1000); // 5 минут
    
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="card p-3 mb-4 bg-gray-50/50 border border-gray-200 rounded-lg">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gray-200 rounded-lg animate-pulse"></div>
          <div className="flex-1">
            <div className="h-4 bg-gray-200 rounded w-32 animate-pulse"></div>
            <div className="text-xs text-gray-500 mt-1">Загрузка информации о подписке...</div>
          </div>
        </div>
      </div>
    );
  }

  // Если есть ошибка
  if (error) {
    return (
      <div className="card p-3 mb-4 bg-red-50/50 border border-red-200 rounded-lg">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center text-base">
            ❌
          </div>
          <div>
            <div className="font-bold text-red-800 text-sm">Ошибка загрузки подписки</div>
            <div className="text-xs text-red-700">{error}</div>
            <div className="text-xs text-red-600 mt-1">Проверьте консоль браузера (F12)</div>
          </div>
        </div>
      </div>
    );
  }

  // Если нет данных о подписке - показываем информационное сообщение для отладки
  if (!subscription) {
    return (
      <div className="card p-3 mb-4 bg-yellow-50/50 border border-yellow-200 rounded-lg">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center text-base">
            ⚠️
          </div>
          <div>
            <div className="font-bold text-yellow-800 text-sm">Информация о подписке недоступна</div>
            <div className="text-xs text-yellow-700">Проверьте консоль браузера (F12) для отладки</div>
          </div>
        </div>
      </div>
    );
  }

  // Если нет ограничений по подписке (старые пользователи) - показываем информационное сообщение
  if (subscription.expiresAt === null || subscription.daysRemaining === null) {
    return (
      <div className="card p-3 mb-4" style={{background: 'linear-gradient(135deg, rgba(255,255,255,0.5) 0%, rgba(59,130,246,0.15) 100%)', borderColor: 'rgba(59,130,246,0.3)'}}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-500/90 backdrop-blur-md rounded-lg flex items-center justify-center text-base border border-white/30 shadow-[0_4px_16px_rgba(59,130,246,0.3)]">
              ℹ️
            </div>
            <div>
              <div className="font-bold text-blue-800 text-sm">Неограниченный доступ</div>
              <div className="text-xs text-blue-700">У вас нет ограничений по подписке</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Если доступ истёк
  if (!subscription.hasAccess) {
    return (
      <div className="card p-3 mb-4" style={{background: 'linear-gradient(135deg, rgba(255,255,255,0.5) 0%, rgba(239,68,68,0.15) 100%)', borderColor: 'rgba(239,68,68,0.3)'}}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-red-500/90 backdrop-blur-md rounded-lg flex items-center justify-center text-base border border-white/30 shadow-[0_4px_16px_rgba(239,68,68,0.3)]">
              ⏰
            </div>
            <div>
              <div className="font-bold text-red-800 text-sm">Доступ истёк</div>
              <div className="text-xs text-red-700">Подписка закончилась</div>
            </div>
          </div>
          <a
            href="https://t.me/roman_acc"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-gradient-to-r from-blue-500/90 to-indigo-600/90 backdrop-blur-md text-white rounded-lg font-semibold text-xs border border-white/20 shadow-[0_4px_16px_rgba(59,130,246,0.3)] hover:shadow-[0_6px_20px_rgba(59,130,246,0.4)] transition-all duration-300 whitespace-nowrap"
          >
            Продлить →
          </a>
        </div>
      </div>
    );
  }

  // Если осталось мало дней (менее 7)
  if (subscription.daysRemaining <= 7) {
    return (
      <div className="card p-3 mb-4" style={{background: 'linear-gradient(135deg, rgba(255,255,255,0.5) 0%, rgba(245,158,11,0.15) 100%)', borderColor: 'rgba(245,158,11,0.3)'}}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-amber-500/90 backdrop-blur-md rounded-lg flex items-center justify-center text-base border border-white/30 shadow-[0_4px_16px_rgba(245,158,11,0.3)]">
              ⚠️
            </div>
            <div>
              <div className="font-bold text-amber-800 text-sm">
                Доступ истекает через {subscription.daysRemaining} {subscription.daysRemaining === 1 ? "день" : subscription.daysRemaining < 5 ? "дня" : "дней"}
              </div>
              <div className="text-xs text-amber-700">
                До {new Date(subscription.expiresAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })} в {new Date(subscription.expiresAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
              </div>
              {subscription.hoursRemaining !== undefined && subscription.hoursRemaining !== null && (
                <div className="text-[10px] text-amber-600 mt-0.5">
                  Осталось: {subscription.hoursRemaining} ч {subscription.minutesRemaining ?? 0} мин
                </div>
              )}
            </div>
          </div>
          <a
            href="https://t.me/roman_acc"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-gradient-to-r from-blue-500/90 to-indigo-600/90 backdrop-blur-md text-white rounded-lg font-semibold text-xs border border-white/20 shadow-[0_4px_16px_rgba(59,130,246,0.3)] hover:shadow-[0_6px_20px_rgba(59,130,246,0.4)] transition-all duration-300 whitespace-nowrap"
          >
            Продлить →
          </a>
        </div>
      </div>
    );
  }

  // Нормальный статус (больше 7 дней)
  return (
    <div className="card p-3 mb-4" style={{background: 'linear-gradient(135deg, rgba(255,255,255,0.5) 0%, rgba(16,185,129,0.15) 100%)', borderColor: 'rgba(16,185,129,0.3)'}}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-green-500/90 backdrop-blur-md rounded-lg flex items-center justify-center text-base border border-white/30 shadow-[0_4px_16px_rgba(16,185,129,0.3)]">
            ✓
          </div>
          <div>
            <div className="font-bold text-green-800 text-sm">
              Доступ активен
            </div>
            <div className="text-xs text-green-700">
              Осталось {subscription.daysRemaining} {subscription.daysRemaining === 1 ? "день" : subscription.daysRemaining < 5 ? "дня" : "дней"} до {new Date(subscription.expiresAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
            </div>
            {subscription.hoursRemaining !== undefined && subscription.hoursRemaining !== null && subscription.hoursRemaining < 24 && (
              <div className="text-[10px] text-green-600 mt-0.5">
                До окончания: {subscription.hoursRemaining} ч {subscription.minutesRemaining ?? 0} мин
              </div>
            )}
          </div>
        </div>
        <a
          href="https://t.me/roman_acc"
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 bg-white/40 backdrop-blur-md border border-white/50 text-gray-700 rounded-lg font-semibold text-xs hover:bg-white/60 hover:shadow-[0_4px_16px_rgba(31,38,135,0.1)] transition-all duration-300 whitespace-nowrap"
        >
          Продлить
        </a>
      </div>
    </div>
  );
}

