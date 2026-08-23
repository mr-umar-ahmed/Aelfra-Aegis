import React from "react";
import type { RiskScoreData } from "@/lib/types";
import { ShieldAlert, AlertTriangle, ShieldCheck } from "lucide-react";

interface RiskGaugeProps {
  data: RiskScoreData | null;
}

export function RiskGauge({ data }: RiskGaugeProps) {
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center p-4 bg-white/5 rounded-2xl border border-white/10 text-center font-mono">
        <ShieldCheck className="w-8 h-8 text-emerald-400 mb-2 animate-pulse" />
        <span className="text-xs font-cyber font-bold text-white uppercase">PACKAGE RISK INDEX</span>
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
    if (s <= 60) return "#f97316"; // Warning Orange
    return "#ef4444"; // Danger Crimson
  };

  const strokeColor = getColor(score);

  return (
    <div className="flex flex-col items-center w-full px-4 font-mono">
      <div className="relative w-48 h-28 flex justify-center overflow-hidden">
        <svg viewBox="0 0 200 120" className="w-full h-full">
          {/* Background Arc */}
          <path
            d={backgroundPath}
            fill="none"
            stroke="#27272a"
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
          <span className="font-cyber font-black text-3xl leading-none text-white font-mono">
            {score}
          </span>
          <span className="text-[10px] uppercase tracking-wider font-cyber font-extrabold text-slate-400 mt-1 flex items-center gap-1">
            {score > 60 ? (
              <ShieldAlert className="w-3.5 h-3.5 text-red-400 animate-bounce" />
            ) : score > 30 ? (
              <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
            ) : (
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
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
              className="bg-white/10 border border-white/20 text-white text-[10px] px-2.5 py-0.5 rounded-full font-mono font-bold uppercase"
            >
              {anomaly}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
