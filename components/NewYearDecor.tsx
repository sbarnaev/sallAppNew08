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
  return (
    <div aria-hidden="true" className="newyear-ornaments">
      <div className="newyear-ornament newyear-ornament--tl" />
      <div className="newyear-ornament newyear-ornament--tr" />
      <div className="newyear-ornament newyear-ornament--br" />
      <div className="newyear-ornament newyear-ornament--bl" />
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


