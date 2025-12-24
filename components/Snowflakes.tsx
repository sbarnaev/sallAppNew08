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
    const count = 36;
    const newSnowflakes = Array.from({ length: count }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 6,
      duration: 12 + Math.random() * 10, // 12–22s
      size: 10 + Math.random() * 10, // px
      drift: (Math.random() * 2 - 1) * 35, // -35..35 px
      opacity: 0.25 + Math.random() * 0.5, // 0.25..0.75
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

