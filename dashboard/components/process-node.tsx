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
      return "border-zinc-700 bg-zinc-900/60 opacity-50 grayscale";
    }
    if (data.hasDotEnvAccess) {
      return "border-red-500 bg-black danger-pulse shadow-xl shadow-red-500/20";
    }
    if (data.severity === "high") {
      return "border-orange-500/80 bg-black shadow-lg shadow-orange-500/10";
    }
    if (data.severity === "medium") {
      return "border-zinc-700 bg-black";
    }
    return "border-white/20 bg-[#0c0c0e] hover:border-white/50";
  };

  return (
    <div className={`px-4 py-3 rounded-2xl border min-w-[220px] transition-all duration-300 ${getStyleClasses()}`}>
      <Handle
        type="target"
        position={Position.Left}
        className="w-3.5 h-3.5 !bg-white border-2 !border-black"
      />

      {/* Node Header */}
      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-2 mb-2">
        <div className="flex items-center gap-2">
          {data.hasDotEnvAccess ? (
            <div className="p-1.5 rounded-xl bg-red-950/80 border border-red-800 text-red-400">
              <ShieldAlert className="w-4 h-4 animate-pulse" />
            </div>
          ) : data.severity === "high" ? (
            <div className="p-1.5 rounded-xl bg-orange-950/80 border border-orange-800 text-orange-400">
              <Wifi className="w-4 h-4" />
            </div>
          ) : (
            <div className="p-1.5 rounded-xl bg-white/10 border border-white/20 text-white">
              <Terminal className="w-4 h-4" />
            </div>
          )}

          <div>
            <div className="font-cyber font-black text-xs text-white uppercase tracking-wider">
              {data.comm}
            </div>
            <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
              <Cpu className="w-3 h-3 text-slate-500" />
              <span>PID: {data.pid}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-1.5 font-mono">
          {data.attack_type && (
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-white border border-white/20 uppercase">
              {data.attack_type}
            </span>
          )}
          {data.hasDotEnvAccess && (
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-950 text-red-300 border border-red-800 uppercase">
              COMPROMISED
            </span>
          )}
        </div>
      </div>

      {/* Meta Info */}
      <div className="text-[10px] font-mono text-slate-300 space-y-1 bg-white/5 p-2 rounded-xl border border-white/10">
        <div className="flex justify-between">
          <span className="text-slate-400">Parent PID:</span>
          <span className="text-white font-bold">{data.ppid || "None"}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-400 flex items-center gap-1">
            <Activity className="w-3 h-3 text-slate-400" /> Syscalls:
          </span>
          <span className="px-1.5 py-0.5 rounded bg-white/10 text-white font-bold">
            {data.events.length}
          </span>
        </div>
      </div>

      {/* Kill Switch CTA */}
      {data.hasDotEnvAccess && (
        <div className="mt-2.5 pt-2 border-t border-white/10">
          {data.isKilled ? (
            <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/60 border border-emerald-800 py-1.5 rounded-xl font-mono font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>TERMINATED</span>
            </div>
          ) : currentState === "sent" ? (
            <div className="text-center text-xs italic text-slate-400 font-mono font-semibold py-1.5">
              SIGKILL sent...
            </div>
          ) : currentState === "armed" ? (
            <div className="flex flex-col gap-1.5 font-mono">
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
                  className="flex-1 text-[10px] font-cyber font-black bg-white hover:bg-orange-500 hover:text-white text-black py-1.5 px-2 rounded-xl transition-all cursor-pointer shadow-md"
                >
                  CONFIRM KILL
                </button>
                <button
                  onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                    e.stopPropagation();
                    clearTimers();
                    setKillConfirmState({ [pidStr]: 'idle' });
                  }}
                  className="flex-1 text-[10px] font-cyber font-black bg-red-600 hover:bg-red-700 text-white py-1.5 px-2 rounded-xl transition-all cursor-pointer shadow-md"
                >
                  CANCEL
                </button>
              </div>
              <div className="text-[9px] text-slate-400 text-center font-bold">
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
              className="w-full flex items-center justify-center gap-2 text-xs font-cyber font-black bg-white hover:bg-red-600 hover:text-white text-black py-2 px-3 rounded-xl transition-all cursor-pointer shadow-lg"
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
        className="w-3.5 h-3.5 !bg-white border-2 !border-black"
      />
    </div>
  );
}
