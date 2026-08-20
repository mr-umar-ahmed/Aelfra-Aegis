"use client";

import React, { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  OnNodesChange,
  OnEdgesChange,
  BackgroundVariant,
} from "@xyflow/react";
import { ProcessNode as ProcessNodeComponent } from "./process-node";
import type { ProcessNode, EventEdge } from "@/lib/types";

interface FlowGraphProps {
  nodes: ProcessNode[];
  edges: EventEdge[];
  onNodesChange?: OnNodesChange<ProcessNode>;
  onEdgesChange?: OnEdgesChange<EventEdge>;
}

export function FlowGraph({ nodes, edges, onNodesChange, onEdgesChange }: FlowGraphProps) {
  const nodeTypes = useMemo(() => ({ processNode: ProcessNodeComponent }), []);

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
          style: { stroke: "#818C78", strokeWidth: 2 },
        }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#A6B49E" />
        <Controls className="!bg-ocean !border-river !text-villa rounded-md" />
        <MiniMap
          nodeColor={(node) => {
            if (node.data?.hasDotEnvAccess) return "#A6B49E";
            if (node.data?.severity === "high") return "#818C78";
            if (node.data?.severity === "medium") return "#818C78";
            return "#4E635E";
          }}
          maskColor="rgba(226, 224, 200, 0.5)"
          className="!bg-villa !border-river rounded-md"
        />
      </ReactFlow>
    </div>
  );
}
