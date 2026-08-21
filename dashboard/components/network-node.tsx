"use client";

import React from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import type { NetworkNode } from "@/lib/types";
import { Network, ShieldAlert } from "lucide-react";

export function NetworkNodeComponent({ data }: NodeProps<NetworkNode>) {
  return (
    <div className="relative flex items-center justify-center w-28 h-28">
      {/* Rotated diamond shape */}
      <div 
        className={`absolute inset-0 rotate-45 border-2 rounded-2xl transition-all duration-300 backdrop-blur-xl ${
          data.threat 
            ? "border-red-500/80 bg-slate-900/90 danger-pulse shadow-xl shadow-red-500/30" 
            : "border-slate-700/80 bg-slate-900/90 hover:border-cyan-500/50"
        }`}
      />

      <Handle
        type="target"
        position={Position.Left}
        className="w-3.5 h-3.5 !bg-red-400 border-2 !border-slate-950 -ml-3 z-10 shadow-sm"
      />

      {/* Content Container (un-rotated to keep text straight) */}
      <div className="relative z-10 flex flex-col items-center text-center px-2 font-mono">
        {data.threat ? (
          <ShieldAlert className="w-5 h-5 text-red-400 mb-1 animate-bounce" />
        ) : (
          <Network className="w-5 h-5 text-cyan-400 mb-1" />
        )}
        
        <div className={`text-[10px] font-extrabold tracking-wide truncate max-w-[80px] ${data.threat ? "text-red-200" : "text-slate-100"}`}>
          {data.dest_ip}
        </div>
        
        <div className={`text-[9px] font-bold mt-0.5 ${data.threat ? "text-red-400" : "text-slate-400"}`}>
          PORT {data.dest_port}
        </div>
      </div>
      
      <Handle
        type="source"
        position={Position.Right}
        className="w-3.5 h-3.5 !bg-red-400 border-2 !border-slate-950 -mr-3 z-10 shadow-sm"
      />
    </div>
  );
}
