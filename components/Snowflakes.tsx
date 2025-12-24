"use client";

import { useEffect, useState } from "react";

export function Snowflakes() {
  const [snowflakes, setSnowflakes] = useState<
    Array<{ id: number; left: number; delay: number; duration: number; size: number; drift: number; opacity: number }>
  >([]);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    // prefers-reduced-motion: выключаем анимации для пользователей, кому они мешают
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(Boolean(mq?.matches));
    update();
    mq?.addEventListener?.("change", update);

    // Создаем снежинки (детерминированно на mount, без random в render)
    // Увеличено количество для насыщенного снегопада
    const count = 120;
    const newSnowflakes = Array.from({ length: count }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 10,
      duration: 8 + Math.random() * 20, // 8–28s (больше вариативности скорости)
      size: 12 + Math.random() * 20, // px (12-32px) - более заметные
      drift: (Math.random() * 2 - 1) * 50, // -50..50 px (больше горизонтального движения)
      opacity: 0.6 + Math.random() * 0.35, // 0.6..0.95 (более заметные снежинки)
    }));
    setSnowflakes(newSnowflakes);

    return () => mq?.removeEventListener?.("change", update);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {snowflakes.map((snowflake) => {
        // Для крупных снежинок используем более медленную анимацию (эффект глубины)
        const isLarge = snowflake.size > 18;
        const animationName = isLarge && !reduceMotion ? "snowfall-slow" : "snowfall";
        
        return (
          <div
            key={snowflake.id}
            className="snowflake"
            style={{
              left: `${snowflake.left}%`,
              animationDelay: `${snowflake.delay}s`,
              animationDuration: `${snowflake.duration}s`,
              fontSize: `${snowflake.size}px`,
              opacity: snowflake.opacity,
              // CSS var to add gentle horizontal drift
              ["--snow-drift" as any]: `${snowflake.drift}px`,
              // If reduced motion -> disable animation entirely
              animation: reduceMotion ? "none" : `${animationName} ${snowflake.duration}s linear infinite`,
            }}
          >
            ❄
          </div>
        );
      })}
    </div>
  );
}

