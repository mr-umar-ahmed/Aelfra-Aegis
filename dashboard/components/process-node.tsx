"use client";

import React from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import type { ProcessNode } from "@/lib/types";
import { ShieldAlert, Terminal, Activity, Skull, CheckCircle2, Cpu, Wifi } from "lucide-react";

export function ProcessNode({ data }: NodeProps<ProcessNode>) {
  const getStyleClasses = () => {
    if (data.isKilled) {
      return "border-slate-700 bg-slate-900/60 opacity-50 grayscale";
    }
    if (data.hasDotEnvAccess) {
      return "border-red-500/80 bg-slate-900/90 glow-red shadow-2xl shadow-red-500/20";
    }
    if (data.severity === "high") {
      return "border-orange-500/80 bg-slate-900/90 shadow-lg shadow-orange-500/20";
    }
    if (data.severity === "medium") {
      return "border-amber-500/80 bg-slate-900/90 shadow-md shadow-amber-500/10";
    }
    return "border-slate-700/80 bg-slate-900/90 hover:border-cyan-500/50 shadow-md shadow-cyan-500/5";
  };

  return (
    <div className={`px-4 py-3.5 rounded-2xl border-2 min-w-[230px] transition-all duration-300 backdrop-blur-xl ${getStyleClasses()}`}>
      <Handle
        type="target"
        position={Position.Left}
        className="w-3.5 h-3.5 !bg-cyan-400 border-2 !border-slate-950 shadow-sm shadow-cyan-400"
      />

      {/* Node Header */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-800/80 pb-2.5 mb-2.5">
        <div className="flex items-center gap-2">
          {data.hasDotEnvAccess ? (
            <div className="p-1.5 rounded-lg bg-red-950/80 border border-red-500/50 text-red-400">
              <ShieldAlert className="w-4 h-4 animate-bounce" />
            </div>
          ) : data.severity === "high" ? (
            <div className="p-1.5 rounded-lg bg-orange-950/80 border border-orange-500/50 text-orange-400">
              <Wifi className="w-4 h-4" />
            </div>
          ) : (
            <div className="p-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-cyan-400">
              <Terminal className="w-4 h-4" />
            </div>
          )}

          <div>
            <div className="font-extrabold text-sm text-slate-100 tracking-wide uppercase font-mono">
              {data.comm}
            </div>
            <div className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
              <Cpu className="w-3 h-3 text-slate-500" />
              <span>PID: {data.pid}</span>
            </div>
          </div>
        </div>

        {data.hasDotEnvAccess && (
          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-red-950 text-red-400 border border-red-800/80 font-mono tracking-widest animate-pulse">
            COMPROMISED
          </span>
        )}
      </div>

      {/* Meta Info */}
      <div className="text-[11px] text-slate-400 space-y-1 font-mono bg-slate-950/50 p-2 rounded-xl border border-slate-800/50">
        <div className="flex justify-between">
          <span className="text-slate-500">Parent PID:</span>
          <span className="text-slate-300 font-semibold">{data.ppid || "None"}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-500 flex items-center gap-1">
            <Activity className="w-3 h-3 text-cyan-500" /> Events:
          </span>
          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 text-[10px]">
            {data.events.length}
          </span>
        </div>
      </div>

      {/* Kill Switch CTA */}
      {data.hasDotEnvAccess && (
        <div className="mt-3 pt-2.5 border-t border-slate-800/80">
          {data.isKilled ? (
            <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/80 border border-emerald-500/40 py-2 rounded-xl font-bold shadow-inner">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>TERMINATED</span>
            </div>
          ) : (
            <button
              onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                e.stopPropagation();
                data.onKill(data.pid);
              }}
              className="w-full flex items-center justify-center gap-2 text-xs font-black bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 active:scale-95 text-white py-2 px-3 rounded-xl transition-all duration-200 shadow-lg shadow-red-600/40 hover:shadow-red-600/60 border border-red-400/30 font-mono tracking-wider cursor-pointer"
            >
              <Skull className="w-4 h-4 animate-pulse" />
              <span>KILL [{data.pid}]</span>
            </button>
          )}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="w-3.5 h-3.5 !bg-cyan-400 border-2 !border-slate-950 shadow-sm shadow-cyan-400"
      />
    </div>
  );
}
