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
    // Увеличено количество для более насыщенного фона
    const count = 60;
    const newSnowflakes = Array.from({ length: count }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 8,
      duration: 10 + Math.random() * 15, // 10–25s (больше вариативности)
      size: 8 + Math.random() * 14, // px (8-22px)
      drift: (Math.random() * 2 - 1) * 40, // -40..40 px (больше горизонтального движения)
      opacity: 0.2 + Math.random() * 0.6, // 0.2..0.8 (больше вариативности прозрачности)
    }));
    setSnowflakes(newSnowflakes);

    return () => mq?.removeEventListener?.("change", update);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {snowflakes.map((snowflake) => (
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
            animation: reduceMotion ? "none" : undefined,
          }}
        >
          ❄
        </div>
      ))}
    </div>
  );
}

