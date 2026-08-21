"use client";

import React from "react";
import type { NarrationMessage } from "@/lib/types";
import { ShieldAlert, Zap } from "lucide-react";

interface ThreatPanelProps {
  narrations: NarrationMessage[];
}

export function ThreatPanel({ narrations }: ThreatPanelProps) {
  return (
    <div className="w-full glass-panel border-t border-slate-800 p-4 flex flex-col shrink-0 min-h-[160px] overflow-hidden">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <h2 className="text-[11px] font-extrabold text-cyan-400 uppercase tracking-widest flex items-center gap-1.5 font-mono">
          <Zap className="w-3.5 h-3.5" />
          <span>Behavioral Threat Intelligence</span>
        </h2>
        <span className="text-[10px] text-slate-500 font-mono">Real-time Causal Provenance</span>
      </div>

      <div className="flex-1 flex flex-col gap-2.5 overflow-y-auto pr-2 relative font-mono text-xs">
        {narrations.length === 0 ? (
          <div className="flex h-full items-center justify-center italic text-slate-500 text-xs py-4">
            Monitoring kernel probes — awaiting attack behavior...
          </div>
        ) : (
          <div className="flex flex-col justify-end min-h-full gap-2.5">
            {narrations.map((narration, i) => {
              const isOldest = i === 0 && narrations.length === 5;
              return (
                <div
                  key={`${narration.pid}-${narration.timestamp}`}
                  className={`flex flex-col bg-slate-900/90 border rounded-xl p-3 transition-all duration-300 ${
                    isOldest ? "opacity-40 border-slate-800" : "opacity-100 border-red-500/50 shadow-lg shadow-red-500/10"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-3.5 h-3.5 text-red-400 animate-pulse" />
                      <span className="px-2 py-0.5 rounded-md bg-red-950/80 border border-red-800 text-[9px] font-black text-red-300 uppercase tracking-wider">
                        {narration.attack_type || "ANOMALY"}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-semibold">PID {narration.pid}</span>
                  </div>

                  <p className="text-xs text-slate-200 leading-relaxed font-sans">
                    {narration.text}
                  </p>

                  <div className="mt-1.5 text-[10px] text-slate-500 font-mono flex justify-between border-t border-slate-800/60 pt-1">
                    <span>Provenance ID: {narration.pid}</span>
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
