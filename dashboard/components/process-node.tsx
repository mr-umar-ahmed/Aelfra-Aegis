"use client";

import React from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import type { ProcessNode } from "@/lib/types";
import { ShieldAlert, Terminal, Activity, Skull, CheckCircle2, Cpu, Wifi } from "lucide-react";

export function ProcessNode({ data }: NodeProps<ProcessNode>) {
  const getStyleClasses = () => {
    if (data.isKilled) {
      return "border-river bg-river/30 opacity-50 grayscale";
    }
    if (data.hasDotEnvAccess) {
      return "border-siren bg-ocean danger-pulse";
    }
    if (data.severity === "high") {
      return "border-siren/70 bg-ocean";
    }
    if (data.severity === "medium") {
      return "border-river bg-ocean";
    }
    return "border-river/50 bg-ocean hover:border-siren/50";
  };

  return (
    <div className={`px-4 py-3 rounded-md border min-w-[210px] transition-all duration-300 ${getStyleClasses()}`}>
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 !bg-siren border !border-ocean"
      />

      {/* Node Header */}
      <div className="flex items-center justify-between gap-3 border-b border-river/30 pb-2 mb-2">
        <div className="flex items-center gap-2">
          {data.hasDotEnvAccess ? (
            <div className="p-1.5 rounded-md bg-siren/20 border border-siren/40 text-villa">
              <ShieldAlert className="w-4 h-4" />
            </div>
          ) : data.severity === "high" ? (
            <div className="p-1.5 rounded-md bg-river/30 border border-river/50 text-villa">
              <Wifi className="w-4 h-4" />
            </div>
          ) : (
            <div className="p-1.5 rounded-md bg-river/20 border border-river/30 text-villa">
              <Terminal className="w-4 h-4" />
            </div>
          )}

          <div>
            <div className="heading text-sm text-villa uppercase">
              {data.comm}
            </div>
            <div className="text-[10px] text-siren flex items-center gap-1">
              <Cpu className="w-3 h-3 text-river" />
              <span>PID: {data.pid}</span>
            </div>
          </div>
        </div>

        {data.hasDotEnvAccess && (
          <span className="label text-[9px] px-2 py-0.5 rounded-md bg-siren/20 text-villa border border-siren/40">
            COMPROMISED
          </span>
        )}
      </div>

      {/* Meta Info */}
      <div className="text-[11px] text-siren space-y-1 bg-ocean/50 p-2 rounded-md border border-river/20">
        <div className="flex justify-between">
          <span className="text-river">Parent PID:</span>
          <span className="text-villa font-semibold">{data.ppid || "None"}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-river flex items-center gap-1">
            <Activity className="w-3 h-3 text-siren" /> Events:
          </span>
          <span className="px-1.5 py-0.5 rounded bg-river/20 text-villa text-[10px] font-semibold">
            {data.events.length}
          </span>
        </div>
      </div>

      {/* Kill Switch CTA */}
      {data.hasDotEnvAccess && (
        <div className="mt-2.5 pt-2 border-t border-river/30">
          {data.isKilled ? (
            <div className="flex items-center justify-center gap-1.5 text-xs text-siren bg-river/20 border border-river/30 py-2 rounded-md font-semibold">
              <CheckCircle2 className="w-4 h-4 text-siren" />
              <span>TERMINATED</span>
            </div>
          ) : (
            <button
              onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                e.stopPropagation();
                data.onKill(data.pid);
              }}
              className="w-full flex items-center justify-center gap-2 text-xs font-bold bg-ocean hover:bg-river/50 active:scale-95 text-villa py-2 px-3 rounded-md transition-all duration-200 border border-siren/60 hover:border-siren cursor-pointer"
            >
              <Skull className="w-4 h-4" />
              <span>KILL [{data.pid}]</span>
            </button>
          )}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 !bg-siren border !border-ocean"
      />
    </div>
  );
}
