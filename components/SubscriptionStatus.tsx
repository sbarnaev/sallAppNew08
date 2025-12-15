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
        }
      } catch (error) {
        console.error("Error loading subscription:", error);
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

  if (loading || !subscription) {
    return null;
  }

  // Если нет ограничений по подписке (старые пользователи)
  if (subscription.expiresAt === null || subscription.daysRemaining === null) {
    return null;
  }

  // Если доступ истёк
  if (!subscription.hasAccess) {
    return (
      <div className="card p-4 bg-gradient-to-br from-red-50 to-orange-50 border-2 border-red-300 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center text-xl">
              ⏰
            </div>
            <div>
              <div className="font-bold text-red-800">Доступ истёк</div>
              <div className="text-sm text-red-700">Подписка закончилась</div>
            </div>
          </div>
          <a
            href="https://t.me/roman_acc"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-semibold text-sm hover:from-blue-600 hover:to-indigo-700 transition-all duration-300"
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
      <div className="card p-4 bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-xl">
              ⚠️
            </div>
            <div>
              <div className="font-bold text-amber-800">
                Доступ истекает через {subscription.daysRemaining} {subscription.daysRemaining === 1 ? "день" : subscription.daysRemaining < 5 ? "дня" : "дней"}
              </div>
              <div className="text-sm text-amber-700">
                До {new Date(subscription.expiresAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })} в {new Date(subscription.expiresAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
              </div>
              {subscription.hoursRemaining !== undefined && subscription.hoursRemaining !== null && (
                <div className="text-xs text-amber-600 mt-1">
                  Осталось: {subscription.hoursRemaining} ч {subscription.minutesRemaining ?? 0} мин
                </div>
              )}
            </div>
          </div>
          <a
            href="https://t.me/roman_acc"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-semibold text-sm hover:from-blue-600 hover:to-indigo-700 transition-all duration-300"
          >
            Продлить →
          </a>
        </div>
      </div>
    );
  }

  // Нормальный статус
  return (
    <div className="card p-4 bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center text-xl">
            ✓
          </div>
            <div>
              <div className="font-bold text-green-800">
                Доступ активен
              </div>
              <div className="text-sm text-green-700">
                Осталось {subscription.daysRemaining} {subscription.daysRemaining === 1 ? "день" : subscription.daysRemaining < 5 ? "дня" : "дней"} до {new Date(subscription.expiresAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
              </div>
              {subscription.hoursRemaining !== undefined && subscription.hoursRemaining !== null && subscription.hoursRemaining < 24 && (
                <div className="text-xs text-green-600 mt-1">
                  До окончания: {subscription.hoursRemaining} ч {subscription.minutesRemaining ?? 0} мин
                </div>
              )}
            </div>
        </div>
        <a
          href="https://t.me/roman_acc"
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-50 transition-all duration-300"
        >
          Продлить
        </a>
      </div>
    </div>
  );
}

