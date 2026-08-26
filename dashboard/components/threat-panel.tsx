"use client";

import React from "react";
import type { NarrationMessage } from "@/lib/types";
import { ShieldAlert, Zap } from "lucide-react";

interface ThreatPanelProps {
  narrations: NarrationMessage[];
}

export function ThreatPanel({ narrations }: ThreatPanelProps) {
  return (
    <div className="w-full h-full p-3.5 sm:p-4 flex flex-col overflow-hidden font-mono bg-transparent">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Zap className="w-4 h-4 text-orange-500 shrink-0 animate-pulse" />
          <h2 className="text-xs font-cyber font-bold text-white uppercase tracking-wider truncate">
            Threat Intelligence
          </h2>
        </div>
        <span className="text-[10px] text-slate-400 font-mono shrink-0 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
          {narrations.length} Active
        </span>
      </div>

      {/* Narrations List */}
      <div className="flex-1 flex flex-col gap-2.5 overflow-y-auto pr-1 relative text-xs font-mono">
        {narrations.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center italic text-slate-400 text-xs py-8 font-sans text-center px-4 gap-2">
            <ShieldAlert className="w-6 h-6 text-slate-600 mb-1" />
            <span>Monitoring kernel probes — awaiting attack behavior...</span>
          </div>
        ) : (
          <div className="flex flex-col justify-end min-h-full gap-2.5">
            {narrations.map((narration, i) => {
              const isOldest = i === 0 && narrations.length === 5;
              return (
                <div
                  key={`${narration.pid}-${narration.timestamp}`}
                  className={`flex flex-col bg-black/90 border rounded-2xl p-3 transition-all duration-300 ${
                    isOldest ? "opacity-40 border-white/10" : "opacity-100 border-red-500/60 shadow-lg shadow-red-500/10"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <ShieldAlert className="w-3.5 h-3.5 text-red-400 shrink-0 animate-pulse" />
                      <span className="px-2 py-0.5 rounded-full bg-red-950/80 border border-red-800 text-[9px] font-cyber font-black text-red-300 uppercase tracking-wider truncate">
                        {narration.attack_type || "ANOMALY"}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-bold shrink-0">PID {narration.pid}</span>
                  </div>

                  <p className="text-xs text-white leading-relaxed font-sans font-medium">
                    {narration.text}
                  </p>

                  <div className="mt-2 text-[10px] text-slate-400 font-mono flex justify-between border-t border-white/10 pt-1.5">
                    <span>Target: PID {narration.pid}</span>
                    <span>
                      {new Date(narration.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
