"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useNodesState, useEdgesState } from "@xyflow/react";
import { FlowGraph } from "@/components/flow-graph";
import type { KernelEvent, ProcessNode, EventEdge, WSMessage } from "@/lib/types";
import { autoLayoutNodes } from "@/lib/layout";
import {
  Shield,
  Radio,
  Activity,
  Terminal,
  AlertTriangle,
  Search,
  Zap,
  ShieldCheck,
  Flame,
  Filter,
  CheckCircle2,
} from "lucide-react";

const WS_URL = "ws://localhost:8765";

export default function DashboardPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState<ProcessNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<EventEdge>([]);
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [eventLogs, setEventLogs] = useState<KernelEvent[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const wsRef = useRef<WebSocket | null>(null);

  const sendKillCommand = useCallback((pid: number) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log(`[KILL ACTION] Sending kill message for PID ${pid}`);
      wsRef.current.send(JSON.stringify({ action: "kill", pid }));
    }
  }, []);

  const handleIncomingEvent = useCallback(
    (event: KernelEvent) => {
      setEventLogs((prev: KernelEvent[]) => [event, ...prev.slice(0, 99)]);

      const isDotEnv = event.event_type === "file_open" && event.filename.includes(".env");
      const nodeId = `process-${event.pid}`;
      const parentNodeId = `process-${event.ppid}`;

      setNodes((prevNodes: ProcessNode[]) => {
        let updatedNodes: ProcessNode[] = [...prevNodes];
        const existingNodeIndex = updatedNodes.findIndex((n: ProcessNode) => n.id === nodeId);

        if (existingNodeIndex >= 0) {
          const targetNode = updatedNodes[existingNodeIndex];
          const hasDotEnv = targetNode.data.hasDotEnvAccess || isDotEnv;
          updatedNodes[existingNodeIndex] = {
            ...targetNode,
            data: {
              ...targetNode.data,
              events: [...targetNode.data.events, event],
              hasDotEnvAccess: hasDotEnv,
              severity: isDotEnv ? "critical" : targetNode.data.severity,
            },
          };
        } else {
          const newNode: ProcessNode = {
            id: nodeId,
            type: "processNode",
            position: { x: 0, y: 0 },
            data: {
              pid: event.pid,
              ppid: event.ppid,
              comm: event.comm,
              severity: isDotEnv ? "critical" : event.severity,
              events: [event],
              hasDotEnvAccess: isDotEnv,
              isKilled: false,
              onKill: sendKillCommand,
            },
          };
          updatedNodes.push(newNode);
        }

        // Add parent node placeholder if absent
        if (event.ppid && event.ppid > 0) {
          const parentExists = updatedNodes.some((n: ProcessNode) => n.id === parentNodeId);
          if (!parentExists) {
            updatedNodes.push({
              id: parentNodeId,
              type: "processNode",
              position: { x: 0, y: 0 },
              data: {
                pid: event.ppid,
                ppid: 0,
                comm: "parent",
                severity: "low",
                events: [],
                hasDotEnvAccess: false,
                isKilled: false,
                onKill: sendKillCommand,
              },
            });
          }
        }

        return autoLayoutNodes(updatedNodes, edges);
      });

      // Add Edge
      if (event.ppid && event.ppid > 0) {
        const edgeId = `edge-${event.ppid}-${event.pid}-${event.event_type}`;
        const edgeLabel =
          event.event_type === "file_open"
            ? "file read"
            : event.event_type === "exec_spawn"
            ? "exec spawn"
            : "net connect";

        const strokeColor =
          isDotEnv ? "#ef4444" : event.event_type === "net_connect" ? "#f97316" : "#06b6d4";

        setEdges((prevEdges: EventEdge[]) => {
          if (prevEdges.some((e: EventEdge) => e.id === edgeId)) return prevEdges;
          return [
            ...prevEdges,
            {
              id: edgeId,
              source: parentNodeId,
              target: nodeId,
              label: edgeLabel,
              animated: true,
              style: { stroke: strokeColor, strokeWidth: 2.5 },
              data: {
                eventType: event.event_type,
                filename: event.filename,
                timestamp: event.timestamp,
              },
            },
          ];
        });
      }
    },
    [edges, sendKillCommand, setEdges, setNodes]
  );

  const handleKillResult = useCallback(
    (pid: number, success: boolean) => {
      if (success) {
        setNodes((prevNodes: ProcessNode[]) =>
          prevNodes.map((n: ProcessNode) =>
            n.data.pid === pid
              ? { ...n, data: { ...n.data, isKilled: true } }
              : n
          )
        );
      }
    },
    [setNodes]
  );

  useEffect(() => {
    let ws: WebSocket;

    function connect() {
      setConnectionStatus("connecting");
      ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => setConnectionStatus("connected");
      ws.onclose = () => {
        setConnectionStatus("disconnected");
        setTimeout(connect, 3000);
      };
      ws.onerror = () => ws.close();

      ws.onmessage = (messageEvent: MessageEvent) => {
        try {
          const payload: WSMessage = JSON.parse(messageEvent.data);
          if (payload.type === "event") {
            handleIncomingEvent(payload.data);
          } else if (payload.type === "kill_result") {
            handleKillResult(payload.pid, payload.success);
          }
        } catch (e) {
          console.error("Failed to parse WS message", e);
        }
      };
    }

    connect();

    return () => {
      if (ws) ws.close();
    };
  }, [handleIncomingEvent, handleKillResult]);

  const compromisedCount = nodes.filter((n: ProcessNode) => n.data.hasDotEnvAccess).length;
  const terminatedCount = nodes.filter((n: ProcessNode) => n.data.isKilled).length;

  const filteredLogs = eventLogs.filter((evt: KernelEvent) => {
    const matchesSearch =
      evt.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
      evt.comm.toLowerCase().includes(searchQuery.toLowerCase()) ||
      evt.pid.toString().includes(searchQuery);

    if (filterSeverity === "all") return matchesSearch;
    return matchesSearch && evt.severity === filterSeverity;
  });

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans select-none">
      {/* Top Header Navigation */}
      <header className="h-16 border-b border-slate-800/80 glass-panel px-6 flex items-center justify-between z-20 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 shadow-lg shadow-cyan-500/30 border border-cyan-400/30">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-black text-lg tracking-wider text-slate-100 flex items-center gap-2 font-mono">
              AELFRA AEGIS <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 font-bold tracking-widest">v1.0 eBPF</span>
            </h1>
            <p className="text-[11px] text-slate-400 font-mono">Supply Chain Attack Detector & Provenance Graph</p>
          </div>
        </div>

        {/* Live System Metrics */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 bg-slate-900/80 px-4 py-2 rounded-2xl border border-slate-800 text-xs font-mono">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span className="text-slate-400">Processes:</span>
              <span className="font-extrabold text-cyan-400">{nodes.length}</span>
            </div>
            <span className="text-slate-700">|</span>
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-red-400" />
              <span className="text-slate-400">Compromised:</span>
              <span className="font-extrabold text-red-400">{compromisedCount}</span>
            </div>
            <span className="text-slate-700">|</span>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-slate-400">Killed:</span>
              <span className="font-extrabold text-emerald-400">{terminatedCount}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-slate-900/80 border border-slate-800 font-mono text-xs shadow-inner">
            <Radio className={`w-3.5 h-3.5 ${connectionStatus === "connected" ? "text-emerald-400 animate-pulse" : "text-amber-400"}`} />
            <span className="font-bold capitalize text-slate-200">{connectionStatus}</span>
          </div>
        </div>
      </header>

      {/* Critical Compromise Alert Banner */}
      {compromisedCount > 0 && terminatedCount < compromisedCount && (
        <div className="bg-gradient-to-r from-red-950 via-red-900 to-red-950 border-b border-red-800/80 px-6 py-2 flex items-center justify-between z-10 animate-pulse">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-red-200">
            <AlertTriangle className="w-4 h-4 text-red-400 animate-bounce" />
            <span>CRITICAL SECURITY ALERT: Active `.env` credential theft detected in process graph! Use the KILL button on compromised nodes to terminate.</span>
          </div>
        </div>
      )}

      {/* Main Graph Canvas & Feed Layout */}
      <div className="flex flex-1 relative overflow-hidden">
        {/* React Flow Canvas Container */}
        <div className="flex-1 h-full relative">
          <FlowGraph
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
          />
        </div>

        {/* Live Event Stream Sidebar Drawer */}
        <div className="w-96 border-l border-slate-800/80 glass-panel flex flex-col h-full z-10">
          {/* Drawer Header */}
          <div className="px-4 py-3.5 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/40">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-200 font-mono">
              <Zap className="w-4 h-4 text-cyan-400" />
              <span>Kernel Event Stream</span>
            </div>
            <span className="text-[11px] bg-slate-800/80 border border-slate-700 px-2 py-0.5 rounded-full text-cyan-400 font-mono font-bold">
              {filteredLogs.length} live
            </span>
          </div>

          {/* Search & Filter Bar */}
          <div className="p-3 border-b border-slate-800/80 space-y-2 bg-slate-900/20">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search PID, comm, path..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono transition-all"
              />
            </div>

            <div className="flex items-center gap-1 text-[11px] font-mono">
              <Filter className="w-3 h-3 text-slate-500" />
              <span className="text-slate-500 mr-1">Filter:</span>
              {["all", "critical", "high", "medium"].map((sev) => (
                <button
                  key={sev}
                  onClick={() => setFilterSeverity(sev)}
                  className={`px-2 py-0.5 rounded-lg uppercase text-[10px] font-bold transition-all ${
                    filterSeverity === sev
                      ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>
          </div>

          {/* Event Stream List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 font-mono text-xs">
            {filteredLogs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2">
                <ShieldCheck className="w-8 h-8 text-slate-700" />
                <p className="text-center text-xs text-slate-500">Awaiting kernel events...</p>
              </div>
            ) : (
              filteredLogs.map((evt: KernelEvent, idx: number) => (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border text-xs transition-all duration-200 glass-card ${
                    evt.severity === "critical"
                      ? "border-red-500/60 bg-red-950/20 text-red-200 shadow-md shadow-red-500/10"
                      : evt.severity === "high"
                      ? "border-orange-500/60 bg-orange-950/20 text-orange-200 shadow-md shadow-orange-500/10"
                      : evt.severity === "medium"
                      ? "border-amber-500/40 bg-amber-950/20 text-amber-200"
                      : "border-slate-800/80 bg-slate-900/50 text-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5 font-bold">
                    <span
                      className={`uppercase text-[10px] tracking-wider px-2 py-0.5 rounded-md font-extrabold ${
                        evt.severity === "critical"
                          ? "bg-red-900/80 text-red-300 border border-red-700"
                          : evt.severity === "high"
                          ? "bg-orange-900/80 text-orange-300 border border-orange-700"
                          : "bg-slate-800 text-cyan-400 border border-slate-700"
                      }`}
                    >
                      {evt.event_type}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">PID {evt.pid}</span>
                  </div>

                  <div className="truncate text-slate-200 font-medium my-1" title={evt.filename}>
                    {evt.filename}
                  </div>

                  <div className="text-[10px] text-slate-500 flex justify-between pt-1 border-t border-slate-800/60">
                    <span>comm: <strong className="text-slate-300">{evt.comm}</strong></span>
                    <span>{new Date(evt.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
