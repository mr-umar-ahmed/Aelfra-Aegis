"use client";

import React from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import type { NetworkNode } from "@/lib/types";
import { Network, ShieldAlert } from "lucide-react";

export function NetworkNodeComponent({ data }: NodeProps<NetworkNode>) {
  return (
    <div className="relative flex items-center justify-center w-24 h-24">
      {/* The rotated diamond shape */}
      <div 
        className={`absolute inset-0 rotate-45 border-2 rounded-sm transition-all duration-300 ${
          data.threat 
            ? "border-siren bg-ocean danger-pulse" 
            : "border-river bg-villa"
        }`}
      />

      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 !bg-siren border !border-ocean -ml-3 z-10"
      />

      {/* Content Container (un-rotated to keep text straight) */}
      <div className="relative z-10 flex flex-col items-center text-center px-2">
        {data.threat ? (
          <ShieldAlert className="w-5 h-5 text-villa mb-1" />
        ) : (
          <Network className="w-5 h-5 text-ocean mb-1" />
        )}
        
        <div className={`text-[9px] font-bold tracking-wide truncate w-full ${data.threat ? "text-villa" : "text-ocean"}`}>
          {data.dest_ip}
        </div>
        
        <div className={`text-[8px] mt-0.5 ${data.threat ? "text-siren" : "text-river"}`}>
          PORT {data.dest_port}
        </div>
      </div>
      
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 !bg-siren border !border-ocean -mr-3 z-10"
      />
    </div>
  );
}
