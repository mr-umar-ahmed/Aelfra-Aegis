"use client";

import React, { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  OnNodesChange,
  OnEdgesChange,
  BackgroundVariant,
} from "@xyflow/react";
import { ProcessNode } from "./process-node";

interface FlowGraphProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
}

export function FlowGraph({ nodes, edges, onNodesChange, onEdgesChange }: FlowGraphProps) {
  const nodeTypes = useMemo(() => ({ processNode: ProcessNode }), []);

  return (
    <div className="w-full h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.2}
        maxZoom={2}
        defaultEdgeOptions={{
          animated: true,
          style: { strokeWidth: 2.5 },
        }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color="#334155" />
        <Controls className="!bg-slate-900/90 !border-slate-800 !text-slate-300 rounded-xl shadow-xl backdrop-blur-md" />
        <MiniMap
          nodeColor={(node) => {
            if (node.data?.hasDotEnvAccess) return "#ef4444";
            if (node.data?.severity === "high") return "#f97316";
            if (node.data?.severity === "medium") return "#eab308";
            return "#06b6d4";
          }}
          maskColor="rgba(15, 23, 42, 0.7)"
          className="!bg-slate-900/90 !border-slate-800 rounded-2xl shadow-2xl backdrop-blur-md"
        />
      </ReactFlow>
    </div>
  );
}
