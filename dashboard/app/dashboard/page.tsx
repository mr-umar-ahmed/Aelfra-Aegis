"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useNodesState, useEdgesState } from "@xyflow/react";
import { FlowGraph } from "@/components/flow-graph";
import type { KernelEvent, ProcessNode, EventEdge, WSMessage } from "@/lib/types";
import { autoLayoutNodes } from "@/lib/layout";
import {
  Shield,
  Activity,
  Terminal,
  AlertTriangle,
  Search,
  Zap,
  Flame,
  Filter,
  CheckCircle2,
  BarChart3,
  Network,
  Eye,
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
              style: { stroke: "#818C78", strokeWidth: 2 },
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
    <div className="flex h-screen w-screen overflow-hidden">
      {/* ─── Left Sidebar (240px) ─── */}
      <aside className="w-60 bg-ocean text-villa flex flex-col shrink-0 border-r border-river/40">
        {/* App Identity */}
        <div className="px-5 py-5 border-b border-river/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-villa/10 border border-river/30">
              <Shield className="w-5 h-5 text-villa" />
            </div>
            <div>
              <h1 className="heading text-lg text-villa">AEGIS</h1>
              <p className="text-[10px] text-siren tracking-label">eBPF Runtime Guard</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          <a className="flex items-center gap-2.5 px-3 py-2 rounded-md bg-villa/10 text-villa text-sm font-semibold">
            <Eye className="w-4 h-4" />
            <span>Process Graph</span>
          </a>
          <a className="flex items-center gap-2.5 px-3 py-2 rounded-md text-siren hover:bg-villa/5 text-sm transition-colors cursor-pointer">
            <Zap className="w-4 h-4" />
            <span>Event Stream</span>
          </a>
          <a className="flex items-center gap-2.5 px-3 py-2 rounded-md text-siren hover:bg-villa/5 text-sm transition-colors cursor-pointer">
            <BarChart3 className="w-4 h-4" />
            <span>Analytics</span>
          </a>
          <a className="flex items-center gap-2.5 px-3 py-2 rounded-md text-siren hover:bg-villa/5 text-sm transition-colors cursor-pointer">
            <Network className="w-4 h-4" />
            <span>Network Map</span>
          </a>
        </nav>

        {/* Sidebar Footer — System Info */}
        <div className="px-4 py-3 border-t border-river/30 text-[10px] text-siren space-y-1">
          <div className="flex justify-between">
            <span>Kernel Probes</span>
            <span className="text-villa font-semibold">openat · execve · connect</span>
          </div>
          <div className="flex justify-between">
            <span>Transport</span>
            <span className="text-villa font-semibold">ws://localhost:8765</span>
          </div>
        </div>
      </aside>

      {/* ─── Main Content Area ─── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* ─── Top Bar ─── */}
        <header className="h-14 bg-ocean border-b border-river/40 px-6 flex items-center justify-between shrink-0">
          {/* Left: Live Metrics */}
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2 text-villa text-xs">
              <Activity className="w-3.5 h-3.5 text-siren" />
              <span className="label text-siren">Processes</span>
              <span className="heading text-base text-villa">{nodes.length}</span>
            </div>
            <div className="w-px h-5 bg-river/40" />
            <div className="flex items-center gap-2 text-villa text-xs">
              <Flame className="w-3.5 h-3.5 text-siren" />
              <span className="label text-siren">Compromised</span>
              <span className="heading text-base text-villa">{compromisedCount}</span>
            </div>
            <div className="w-px h-5 bg-river/40" />
            <div className="flex items-center gap-2 text-villa text-xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-siren" />
              <span className="label text-siren">Killed</span>
              <span className="heading text-base text-villa">{terminatedCount}</span>
            </div>
          </div>

          {/* Right: Status */}
          <div className="flex items-center gap-3">
            <span className="label text-siren">
              {eventLogs.length} events
            </span>
            <div className="flex items-center gap-2 px-3 py-1 rounded-md border border-river/40 bg-ocean">
              <span className={`w-2 h-2 rounded-full ${connectionStatus === "connected" ? "bg-siren animate-pulse" : "bg-river"}`} />
              <span className="label text-villa">
                {connectionStatus === "connected" ? "MONITORING" : connectionStatus === "connecting" ? "CONNECTING" : "OFFLINE"}
              </span>
            </div>
          </div>
        </header>

        {/* ─── Critical Alert Banner ─── */}
        {compromisedCount > 0 && terminatedCount < compromisedCount && (
          <div className="bg-ocean border-b border-river/40 px-6 py-2 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 text-xs text-villa">
              <AlertTriangle className="w-4 h-4 text-siren danger-pulse" />
              <span className="font-semibold">ALERT: Active credential theft detected — use KILL on compromised nodes to terminate.</span>
            </div>
          </div>
        )}

        {/* ─── Main Area: Graph + Event Sidebar ─── */}
        <div className="flex flex-1 overflow-hidden">
          {/* Graph Panel */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Graph Card */}
            <div className="flex-1 m-4 mb-2 bg-villa border border-river/40 rounded-md overflow-hidden relative">
              <FlowGraph
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
              />
            </div>

            {/* Stats Strip — 4 Metric Cards */}
            <div className="mx-4 mb-4 grid grid-cols-4 gap-3">
              <div className="bg-ocean rounded-md p-3 border border-river/30">
                <p className="label text-siren mb-1">Total Processes</p>
                <p className="heading text-2xl text-villa">{nodes.length}</p>
              </div>
              <div className="bg-ocean rounded-md p-3 border border-river/30">
                <p className="label text-siren mb-1">Kernel Events</p>
                <p className="heading text-2xl text-villa">{eventLogs.length}</p>
              </div>
              <div className="bg-ocean rounded-md p-3 border border-river/30">
                <p className="label text-siren mb-1">Compromised</p>
                <p className="heading text-2xl text-villa">{compromisedCount}</p>
              </div>
              <div className="bg-ocean rounded-md p-3 border border-river/30">
                <p className="label text-siren mb-1">Terminated</p>
                <p className="heading text-2xl text-villa">{terminatedCount}</p>
              </div>
            </div>
          </div>

          {/* ─── Event Stream Sidebar ─── */}
          <div className="w-80 bg-ocean border-l border-river/40 flex flex-col shrink-0">
            {/* Sidebar Header */}
            <div className="px-4 py-3 border-b border-river/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-siren" />
                <span className="label text-villa">Event Stream</span>
              </div>
              <span className="label text-siren">
                {filteredLogs.length} live
              </span>
            </div>

            {/* Search & Filter */}
            <div className="p-3 border-b border-river/30 space-y-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-siren absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search PID, comm, path..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-ocean border border-river/40 rounded-md pl-8 pr-3 py-1.5 text-xs text-villa placeholder:text-river focus:outline-none focus:border-siren transition-colors"
                />
              </div>

              <div className="flex items-center gap-1 text-[11px]">
                <Filter className="w-3 h-3 text-river" />
                {["all", "critical", "high", "medium"].map((sev) => (
                  <button
                    key={sev}
                    onClick={() => setFilterSeverity(sev)}
                    className={`px-2 py-0.5 rounded-md uppercase text-[10px] font-semibold transition-colors ${
                      filterSeverity === sev
                        ? "bg-villa/15 text-villa border border-villa/30"
                        : "text-river hover:text-siren"
                    }`}
                  >
                    {sev}
                  </button>
                ))}
              </div>
            </div>

            {/* Event List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 text-xs">
              {filteredLogs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-river gap-2">
                  <Terminal className="w-6 h-6 text-river/60" />
                  <p className="text-center text-xs text-river">Awaiting kernel events...</p>
                </div>
              ) : (
                filteredLogs.map((evt: KernelEvent, idx: number) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-md border text-xs transition-colors ${
                      evt.severity === "critical"
                        ? "border-siren bg-villa/10 text-villa"
                        : evt.severity === "high"
                        ? "border-river bg-villa/5 text-villa"
                        : "border-river/30 bg-ocean text-siren"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className={`uppercase text-[10px] tracking-label font-semibold px-2 py-0.5 rounded-md ${
                          evt.severity === "critical"
                            ? "bg-siren/20 text-villa"
                            : evt.severity === "high"
                            ? "bg-river/30 text-villa"
                            : "bg-river/20 text-siren"
                        }`}
                      >
                        {evt.event_type}
                      </span>
                      <span className="text-[10px] text-river">PID {evt.pid}</span>
                    </div>

                    <div className="truncate text-villa/90 font-medium my-1" title={evt.filename}>
                      {evt.filename}
                    </div>

                    <div className="text-[10px] text-river flex justify-between pt-1 border-t border-river/20">
                      <span>comm: <strong className="text-villa/80">{evt.comm}</strong></span>
                      <span>{new Date(evt.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
