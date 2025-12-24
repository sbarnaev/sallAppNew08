"use client";

import { Snowflakes } from "@/components/Snowflakes";
import { useEffect, useState } from "react";

function Garland() {
  return (
    <div aria-hidden="true" className="newyear-garland">
      <svg viewBox="0 0 1440 140" preserveAspectRatio="none" className="newyear-garland__svg">
        <path
          d="M0,40 C180,120 360,0 540,60 C720,120 900,10 1080,60 C1260,110 1350,20 1440,60"
          fill="none"
          stroke="rgba(15, 23, 42, 0.18)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M0,40 C180,120 360,0 540,60 C720,120 900,10 1080,60 C1260,110 1350,20 1440,60"
          fill="none"
          stroke="rgba(255, 255, 255, 0.35)"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Lights */}
        {Array.from({ length: 24 }).map((_, i) => {
          const x = (i * 1440) / 23;
          const y = 40 + Math.sin((i / 23) * Math.PI * 2) * 10 + (i % 2 ? 6 : -4);
          const colors = ["#DC2626", "#16A34A", "#EAB308", "#2563EB"];
          const c = colors[i % colors.length];
          return (
            <g key={i} className="newyear-light" style={{ ["--twinkle-delay" as any]: `${(i % 8) * 0.25}s` }}>
              <circle cx={x} cy={y} r="7" fill="rgba(255,255,255,0.55)" />
              <circle cx={x} cy={y} r="5" fill={c} />
              <circle cx={x} cy={y} r="12" fill={c} opacity="0.18" />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function Ornaments() {
  // Создаем равномерно распределенные позиции по сетке с случайными смещениями
  const generateUniformPositions = (totalCount: number) => {
    const positions: Array<{ top: number; left: number }> = [];
    const gridCols = Math.ceil(Math.sqrt(totalCount * 1.5)); // Немного больше колонок для лучшего распределения
    const gridRows = Math.ceil(totalCount / gridCols);
    
    const cellWidth = 100 / gridCols;
    const cellHeight = 100 / gridRows;
    
    // Создаем сетку позиций
    for (let i = 0; i < totalCount; i++) {
      const col = i % gridCols;
      const row = Math.floor(i / gridCols);
      
      // Центр ячейки + случайное смещение (до 30% от размера ячейки)
      const left = col * cellWidth + cellWidth / 2 + (Math.random() - 0.5) * cellWidth * 0.6;
      const top = row * cellHeight + cellHeight / 2 + (Math.random() - 0.5) * cellHeight * 0.6;
      
      positions.push({
        top: Math.max(5, Math.min(95, top)), // Ограничиваем краями (5-95%)
        left: Math.max(5, Math.min(95, left)),
      });
    }
    
    // Перемешиваем позиции для максимальной случайности
    for (let i = positions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [positions[i], positions[j]] = [positions[j], positions[i]];
    }
    
    return positions;
  };

  // Все эмодзи в одном массиве для равномерного распределения
  const emojiList = [
    ...Array(12).fill("🎄"), // Елочки
    ...Array(8).fill("⛄"),  // Снеговики
    ...Array(6).fill("🎁"),  // Подарки
    ...Array(6).fill("⭐"),  // Звездочки
    ...Array(4).fill("🎅"),  // Санты
    ...Array(3).fill("🦌"),  // Олени
    ...Array(4).fill("🔔"),  // Колокольчики
  ];
  
  // Перемешиваем эмодзи для случайного порядка
  const shuffledEmojis = [...emojiList].sort(() => Math.random() - 0.5);
  
  // Генерируем равномерно распределенные позиции
  const positions = generateUniformPositions(shuffledEmojis.length);
  
  // Объединяем эмодзи с позициями
  const allOrnaments = shuffledEmojis.map((emoji, i) => ({
    id: i,
    emoji,
    ...positions[i],
    size: 40 + Math.random() * 30, // 40-70px
    opacity: 0.6 + Math.random() * 0.3, // 0.6-0.9
  }));

  return (
    <div aria-hidden="true" className="newyear-ornaments">
      {allOrnaments.map((ornament) => (
        <div
          key={`ornament-${ornament.id}`}
          className="newyear-ornament-scattered"
          style={{
            top: `${ornament.top}%`,
            left: `${ornament.left}%`,
            fontSize: `${ornament.size}px`,
            opacity: ornament.opacity,
          }}
          data-emoji={ornament.emoji}
        />
      ))}
    </div>
  );
}

export function NewYearDecor() {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    // On very small screens we keep decor, but reduce density; can be tuned later.
    setEnabled(true);
  }, []);

  if (!enabled) return null;

  return (
    <div className="newyear-layer" aria-hidden="true">
      <Garland />
      <Ornaments />
      <Snowflakes />
    </div>
  );
}


