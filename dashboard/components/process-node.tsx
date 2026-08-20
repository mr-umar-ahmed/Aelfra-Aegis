import React, { useState, useEffect, useRef } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import type { ProcessNode } from "@/lib/types";
import { ShieldAlert, Terminal, Activity, Skull, CheckCircle2, Cpu, Wifi } from "lucide-react";

export function ProcessNode({ data }: NodeProps<ProcessNode>) {
  const pidStr = data.pid.toString();
  const [killConfirmState, setKillConfirmState] = useState<Record<string, 'idle' | 'armed' | 'sent'>>({
    [pidStr]: 'idle'
  });
  const [countdown, setCountdown] = useState(5);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimers = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  useEffect(() => {
    return () => clearTimers();
  }, []);

  const currentState = killConfirmState[pidStr] || 'idle';

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

        <div className="flex gap-2">
          {data.attack_type && (
            <span className="label text-[9px] px-2 py-0.5 rounded-md bg-river/20 text-villa border border-river/40">
              {data.attack_type}
            </span>
          )}
          {data.hasDotEnvAccess && (
            <span className="label text-[9px] px-2 py-0.5 rounded-md bg-siren/20 text-villa border border-siren/40">
              COMPROMISED
            </span>
          )}
        </div>
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
          ) : currentState === "sent" ? (
            <div className="text-center text-xs italic text-river font-semibold py-2">
              SIGKILL sent
            </div>
          ) : currentState === "armed" ? (
            <div className="flex flex-col gap-1.5 transition-all duration-200">
              <div className="flex gap-2">
                <button
                  onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                    e.stopPropagation();
                    clearTimers();
                    setKillConfirmState({ [pidStr]: 'sent' });
                    data.onKill(data.pid);
                    timeoutRef.current = setTimeout(() => {
                      setKillConfirmState({ [pidStr]: 'idle' });
                    }, 3000);
                  }}
                  className="flex-1 flex items-center justify-center text-[10px] font-bold bg-ocean text-villa py-1 px-2 rounded border border-river/30 hover:bg-river/30 cursor-pointer transition-colors"
                >
                  Confirm Kill
                </button>
                <button
                  onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                    e.stopPropagation();
                    clearTimers();
                    setKillConfirmState({ [pidStr]: 'idle' });
                  }}
                  className="flex-1 flex items-center justify-center text-[10px] font-bold bg-siren text-ocean py-1 px-2 rounded border border-river/40 hover:bg-river/30 cursor-pointer transition-colors"
                >
                  Cancel
                </button>
              </div>
              <div className="text-[10px] text-river text-center font-medium">
                Auto-cancel in {countdown}s...
              </div>
            </div>
          ) : (
            <button
              onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                e.stopPropagation();
                clearTimers();
                setCountdown(5);
                setKillConfirmState({ [pidStr]: 'armed' });
                
                intervalRef.current = setInterval(() => {
                  setCountdown((prev) => Math.max(prev - 1, 0));
                }, 1000);

                timeoutRef.current = setTimeout(() => {
                  clearTimers();
                  setKillConfirmState({ [pidStr]: 'idle' });
                }, 5000);
              }}
              className="w-full flex items-center justify-center gap-2 text-xs font-semibold bg-ocean hover:bg-river/30 text-villa py-1.5 px-2.5 rounded-md border border-river cursor-pointer transition-colors"
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
