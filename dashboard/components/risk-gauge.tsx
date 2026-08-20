import React from "react";
import type { RiskScoreData } from "@/lib/types";

interface RiskGaugeProps {
  data: RiskScoreData | null;
}

export function RiskGauge({ data }: RiskGaugeProps) {
  if (!data) return null;

  const score = data.score;
  const cx = 100;
  const cy = 100;
  const r = 80;
  
  const theta = Math.PI - (score / 100) * Math.PI;
  const startX = cx - r;
  const startY = cy;
  
  // If score is 0, end coordinates equal start coordinates, which can make SVG paths vanish or act weird.
  // We clamp it slightly above 0 for the visual path.
  const visualScore = Math.max(score, 0.1);
  const visualTheta = Math.PI - (visualScore / 100) * Math.PI;
  
  const endX = cx + r * Math.cos(visualTheta);
  const endY = cy - r * Math.sin(visualTheta);
  
  const backgroundPath = `M ${startX} ${startY} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  const foregroundPath = `M ${startX} ${startY} A ${r} ${r} 0 0 1 ${endX} ${endY}`;
  
  const getColor = (s: number) => {
    if (s <= 30) return "#A6B49E"; // Siren Song
    if (s <= 60) return "#818C78"; // Big River
    return "#4E635E"; // Ocean Deep
  };

  const strokeColor = getColor(score);

  return (
    <div className="flex flex-col items-center mt-6 w-full px-4">
      <div className="relative w-48 h-28 flex justify-center overflow-hidden">
        <svg viewBox="0 0 200 120" className="w-full h-full">
          {/* Background Arc */}
          <path
            d={backgroundPath}
            fill="none"
            strokeWidth="16"
            strokeLinecap="round"
            className="stroke-villa opacity-50"
          />
          {/* Value Arc */}
          <path
            d={foregroundPath}
            fill="none"
            stroke={strokeColor}
            strokeWidth="16"
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.5s ease" }}
          />
        </svg>
        <div className="absolute bottom-2 flex flex-col items-center">
          <span className="font-[800] text-[32px] leading-none text-ocean">
            {score}
          </span>
          <span className="text-river text-[11px] uppercase tracking-wider font-semibold mt-1">
            PACKAGE RISK
          </span>
        </div>
      </div>

      {data.anomalies.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4 w-full justify-center">
          {data.anomalies.map((anomaly, idx) => (
            <div
              key={idx}
              className="bg-ocean text-villa text-[10px] px-2 py-1 rounded-sm uppercase tracking-wide"
            >
              {anomaly}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
