"use client";

import React from "react";
import type { NarrationMessage } from "@/lib/types";

interface ThreatPanelProps {
  narrations: NarrationMessage[];
}

export function ThreatPanel({ narrations }: ThreatPanelProps) {
  return (
    <div className="w-full bg-villa border-t-[3px] border-ocean p-4 flex flex-col shrink-0 min-h-[160px] overflow-hidden">
      <h2 className="text-[10px] font-bold text-river uppercase tracking-[0.15em] mb-3 shrink-0">
        Threat Intelligence
      </h2>

      <div className="flex-1 flex flex-col gap-3 overflow-y-auto pr-2 relative">
        {narrations.length === 0 ? (
          <div className="flex h-full items-center justify-center italic text-siren text-sm pb-4">
            No threats detected — monitoring active
          </div>
        ) : (
          <div className="flex flex-col justify-end min-h-full gap-3">
            {narrations.map((narration, i) => {
              const isOldest = i === 0 && narrations.length === 5;
              return (
                <div
                  key={`${narration.pid}-${narration.timestamp}`}
                  className={`flex flex-col bg-villa transition-all duration-500 ease-in-out transform origin-bottom border border-river/30 rounded-md p-3 ${
                    isOldest ? "opacity-40" : "opacity-100"
                  } animate-in slide-in-from-bottom-2 fade-in`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="px-2 py-0.5 rounded-full bg-siren/20 border border-siren/40 text-[9px] font-bold text-ocean uppercase tracking-wider">
                      {narration.attack_type || "ANOMALY"}
                    </span>
                    <span className="text-[10px] text-river">PID {narration.pid}</span>
                  </div>
                  <p className={`text-[15px] font-normal leading-relaxed ${isOldest ? "text-siren" : "text-ocean"}`}>
                    {narration.text}
                  </p>
                  <div className="mt-2 text-[11px] text-river font-medium">
                    {new Date(narration.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    })}
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
