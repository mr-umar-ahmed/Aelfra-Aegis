import React from "react";
import type { RiskScoreData } from "@/lib/types";
import { ShieldAlert, AlertTriangle, ShieldCheck } from "lucide-react";

interface RiskGaugeProps {
  data: RiskScoreData | null;
}

export function RiskGauge({ data }: RiskGaugeProps) {
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center p-4 bg-slate-900/40 rounded-2xl border border-slate-800 text-center">
        <ShieldCheck className="w-8 h-8 text-emerald-400 mb-2 animate-pulse" />
        <span className="text-xs font-bold text-slate-200">PACKAGE RISK INDEX</span>
        <span className="text-[10px] text-slate-400 mt-1">0 / 100 — Clean</span>
      </div>
    );
  }

  const score = data.score;
  const cx = 100;
  const cy = 100;
  const r = 75;
  
  const visualScore = Math.max(score, 0.1);
  const visualTheta = Math.PI - (visualScore / 100) * Math.PI;
  
  const startX = cx - r;
  const startY = cy;
  const endX = cx + r * Math.cos(visualTheta);
  const endY = cy - r * Math.sin(visualTheta);
  
  const backgroundPath = `M ${startX} ${startY} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  const foregroundPath = `M ${startX} ${startY} A ${r} ${r} 0 0 1 ${endX} ${endY}`;
  
  const getColor = (s: number) => {
    if (s <= 30) return "#10b981"; // Emerald Clean
    if (s <= 60) return "#f59e0b"; // Warning Gold
    return "#ef4444"; // Danger Crimson
  };

  const strokeColor = getColor(score);

  return (
    <div className="flex flex-col items-center w-full px-4">
      <div className="relative w-48 h-28 flex justify-center overflow-hidden">
        <svg viewBox="0 0 200 120" className="w-full h-full">
          {/* Background Arc */}
          <path
            d={backgroundPath}
            fill="none"
            stroke="#1e293b"
            strokeWidth="14"
            strokeLinecap="round"
          />
          {/* Value Arc */}
          <path
            d={foregroundPath}
            fill="none"
            stroke={strokeColor}
            strokeWidth="14"
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.5s ease" }}
          />
        </svg>

        <div className="absolute bottom-1 flex flex-col items-center">
          <span className="font-black text-3xl leading-none text-slate-100 font-mono">
            {score}
          </span>
          <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 mt-1 flex items-center gap-1">
            {score > 60 ? (
              <ShieldAlert className="w-3 h-3 text-red-400 animate-bounce" />
            ) : score > 30 ? (
              <AlertTriangle className="w-3 h-3 text-amber-400" />
            ) : (
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
            )}
            <span>THREAT LEVEL</span>
          </span>
        </div>
      </div>

      {data.anomalies.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3 w-full justify-center">
          {data.anomalies.map((anomaly, idx) => (
            <span
              key={idx}
              className="bg-slate-900 border border-slate-700 text-slate-200 text-[10px] px-2 py-0.5 rounded-lg font-mono font-semibold"
            >
              {anomaly}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
