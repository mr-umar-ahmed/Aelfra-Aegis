"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useNodesState, useEdgesState } from "@xyflow/react";
import { FlowGraph } from "@/components/flow-graph";
import { ThreatPanel } from "@/components/threat-panel";
import { RiskGauge } from "@/components/risk-gauge";
import { exportReportToHTML } from "@/lib/export";
import type { KernelEvent, ProcessNode, NetworkNode, EventEdge, WSMessage, NarrationMessage, RiskScoreData, IncidentData } from "@/lib/types";
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
  Download,
} from "lucide-react";

const WS_URL = "ws://localhost:8765";

export default function DashboardPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState<ProcessNode | NetworkNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<EventEdge>([]);
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [eventLogs, setEventLogs] = useState<KernelEvent[]>([]);
  const [narrations, setNarrations] = useState<NarrationMessage[]>([]);
  const [riskData, setRiskData] = useState<RiskScoreData | null>(null);
  const [incidents, setIncidents] = useState<IncidentData[]>([]);
  const [activeTab, setActiveTab] = useState<"graph" | "timeline">("graph");
  const [timelineSearch, setTimelineSearch] = useState("");
  const [expandedIncident, setExpandedIncident] = useState<number | null>(null);
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

      setNodes((prevNodes: (ProcessNode | NetworkNode)[]) => {
        let updatedNodes: (ProcessNode | NetworkNode)[] = [...prevNodes];
        const existingNodeIndex = updatedNodes.findIndex((n: any) => n.id === nodeId);

        if (existingNodeIndex >= 0) {
          const targetNode = updatedNodes[existingNodeIndex] as ProcessNode;
          const hasDotEnv = targetNode.data.hasDotEnvAccess || isDotEnv;
          updatedNodes[existingNodeIndex] = {
            ...targetNode,
            data: {
              ...targetNode.data,
              events: [...targetNode.data.events, event],
              hasDotEnvAccess: hasDotEnv,
              severity: isDotEnv ? "critical" : targetNode.data.severity,
              attack_type: (event.attack_type && event.attack_type !== "UNKNOWN") ? event.attack_type : targetNode.data.attack_type,
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
              attack_type: event.attack_type,
              events: [event],
              hasDotEnvAccess: isDotEnv,
              isKilled: false,
              onKill: sendKillCommand,
            },
          };
          updatedNodes.push(newNode);
        }

        if (event.event_type === "network") {
          const networkNodeId = `network-${event.dest_ip}:${event.dest_port}`;
          const existingNetworkNode = updatedNodes.findIndex((n: any) => n.id === networkNodeId);
          if (existingNetworkNode >= 0) {
            const netNode = updatedNodes[existingNetworkNode] as NetworkNode;
            if (event.threat) {
              updatedNodes[existingNetworkNode] = {
                ...netNode,
                data: { ...netNode.data, threat: true }
              };
            }
          } else {
            const newNetNode: NetworkNode = {
              id: networkNodeId,
              type: "networkNode",
              position: { x: 0, y: 0 },
              data: {
                pid: event.pid,
                comm: event.comm,
                dest_ip: event.dest_ip || "unknown",
                dest_port: event.dest_port || 0,
                threat: event.threat || false,
              },
            };
            updatedNodes.push(newNetNode);
          }
        }

        // Add parent node placeholder if absent
        if (event.ppid && event.ppid > 0) {
          const parentExists = updatedNodes.some((n: any) => n.id === parentNodeId);
          if (!parentExists) {
            const newParentNode: ProcessNode = {
              id: parentNodeId,
              type: "processNode",
              position: { x: 0, y: 0 },
              data: {
                pid: event.ppid,
                ppid: 0,
                comm: "parent",
                severity: "low",
                attack_type: undefined,
                events: [],
                hasDotEnvAccess: false,
                isKilled: false,
                onKill: sendKillCommand,
              },
            };
            updatedNodes.push(newParentNode);
          }
        }

        return autoLayoutNodes(updatedNodes as any, edges) as any;
      });

      // Add Edge
      if (event.event_type === "network") {
        const edgeId = `edge-${event.pid}-${event.dest_ip}:${event.dest_port}`;
        setEdges((prevEdges: EventEdge[]) => {
          if (prevEdges.some((e: EventEdge) => e.id === edgeId)) return prevEdges;
          return [
            ...prevEdges,
            {
              id: edgeId,
              source: nodeId,
              target: `network-${event.dest_ip}:${event.dest_port}`,
              label: "tcp_connect",
              animated: true,
              style: { stroke: "#818C78", strokeWidth: 2, strokeDasharray: "5,5" },
              data: {
                eventType: "network",
                filename: `${event.dest_ip}:${event.dest_port}`,
                timestamp: event.timestamp,
              },
            },
          ];
        });
      } else if (event.ppid && event.ppid > 0) {
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
        setNodes((prevNodes: (ProcessNode | NetworkNode)[]) =>
          prevNodes.map((n: any) =>
            n.type === "processNode" && n.data.pid === pid
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

      ws.onopen = () => {
        setConnectionStatus("connected");
        ws.send(JSON.stringify({ action: "get_history", limit: 50 }));
      };
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
          } else if (payload.type === "narration") {
            setNarrations((prev) => [payload, ...prev].slice(0, 5));
          } else if (payload.type === "risk_score") {
            setRiskData(payload.data);
          } else if (payload.type === "history") {
            setIncidents(payload.incidents);
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

  const compromisedCount = nodes.filter((n: any) => n.type === "processNode" && n.data.hasDotEnvAccess).length;
  const terminatedCount = nodes.filter((n: any) => n.type === "processNode" && n.data.isKilled).length;
  const processCount = nodes.filter((n: any) => n.type === "processNode").length;
  const networkConnections = nodes.filter((n: any) => n.type === "networkNode").length;
  const threatsDetected = nodes.filter((n: any) => n.type === "networkNode" && n.data.threat).length;

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

        {/* Risk Score Gauge */}
        <div className="pb-6">
          <RiskGauge data={riskData} />
        </div>

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
              <span className="heading text-base text-villa">{processCount}</span>
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

          {/* Top Bar Tabs (Center) */}
          <div className="flex bg-ocean border border-river/40 rounded-md p-1">
            <button 
              onClick={() => setActiveTab("graph")}
              className={`px-4 py-1 rounded text-sm font-semibold transition-colors ${activeTab === "graph" ? "bg-villa text-ocean" : "text-siren hover:text-villa"}`}
            >
              GRAPH
            </button>
            <button 
              onClick={() => setActiveTab("timeline")}
              className={`px-4 py-1 rounded text-sm font-semibold transition-colors ${activeTab === "timeline" ? "bg-villa text-ocean" : "text-siren hover:text-villa"}`}
            >
              TIMELINE
            </button>
          </div>

          {/* Right: Status */}
          <div className="flex items-center gap-3">
            <button 
              onClick={() => exportReportToHTML(incidents)}
              className="flex items-center gap-2 bg-siren hover:bg-villa text-ocean px-3 py-1.5 rounded-md text-xs font-bold transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              EXPORT REPORT
            </button>
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

        {/* ─── Main Area: Graph/Timeline + Event Sidebar ─── */}
        <div className="flex flex-1 overflow-hidden">
          {activeTab === "graph" ? (
            <div className="flex-1 flex flex-col min-w-0">
              {/* Graph Card */}
              <div className="flex-1 m-4 mb-2 bg-villa border border-river/40 rounded-md overflow-hidden flex flex-col relative">
                {connectionStatus === "connecting" && (
                  <div className="absolute inset-0 z-50 bg-ocean/95 flex flex-col items-center justify-center gap-4">
                    <div className="w-80 h-32 rounded bg-ocean border border-river/40 relative overflow-hidden flex flex-col items-center justify-center gap-3">
                      <div className="absolute inset-0 shimmer opacity-20" />
                      <Shield className="w-8 h-8 text-siren animate-pulse" />
                      <p className="text-villa text-[10px] uppercase tracking-wider font-semibold animate-pulse">
                        Connecting to eBPF Sensor...
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex-1 relative">
                  <FlowGraph
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                  />
                </div>
                <ThreatPanel narrations={narrations} />
              </div>

              {/* Stats Strip — Metric Cards */}
              <div className="mx-4 mb-4 grid grid-cols-6 gap-3">
                <div className="bg-ocean rounded-md p-3 border border-river/30">
                  <p className="label text-siren mb-1">Total Processes</p>
                  <p className="heading text-2xl text-villa">{processCount}</p>
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
                <div className="bg-ocean rounded-md p-3 border border-river/30">
                  <p className="label text-siren mb-1">Net Connections</p>
                  <p className="heading text-2xl text-villa">{networkConnections}</p>
                </div>
                <div className="bg-ocean rounded-md p-3 border border-river/30">
                  <p className="label text-siren mb-1">Threats Detected</p>
                  <p className="heading text-2xl text-villa">{threatsDetected}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 p-6 overflow-y-auto bg-villa/20">
              <div className="max-w-4xl mx-auto space-y-4">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-ocean">Incident Timeline</h2>
                  <div className="relative w-64">
                    <Search className="w-4 h-4 text-river absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Filter by Attack Type or PID..."
                      value={timelineSearch}
                      onChange={(e) => setTimelineSearch(e.target.value)}
                      className="w-full bg-white border border-river/40 rounded-md pl-9 pr-3 py-2 text-sm text-ocean focus:outline-none focus:border-ocean transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  {incidents.filter(inc => 
                    inc.attack_type.toLowerCase().includes(timelineSearch.toLowerCase()) || 
                    inc.pid.toString().includes(timelineSearch)
                  ).map((inc) => (
                    <div key={inc.id} className="bg-villa border border-river/40 rounded-md overflow-hidden cursor-pointer shadow-sm hover:shadow-md transition-shadow" onClick={() => setExpandedIncident(expandedIncident === inc.id ? null : inc.id)}>
                      <div className="flex items-center p-4 border-l-4 border-l-ocean">
                        <div className="flex-1 flex items-center gap-4">
                          <span className="bg-ocean text-villa text-xs font-bold px-2 py-1 rounded uppercase">{inc.attack_type}</span>
                          <span className="text-sm font-medium text-ocean">PID: {inc.pid}</span>
                          <span className="text-xs text-river">{new Date(inc.start_time).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm font-bold text-ocean">Risk: {inc.risk_score}</span>
                          <span className={`text-xs font-bold px-2 py-1 rounded ${inc.status === 'terminated' ? 'bg-siren text-ocean' : 'bg-red-100 text-red-800'}`}>{inc.status.toUpperCase()}</span>
                        </div>
                      </div>
                      
                      {expandedIncident === inc.id && (
                        <div className="p-4 border-t border-river/20 bg-white">
                          {inc.narration_text && (
                            <div className="mb-4 p-3 bg-villa/50 border-l-2 border-siren text-sm text-ocean">
                              <strong>Narrative:</strong> {inc.narration_text}
                            </div>
                          )}
                          <div className="text-xs text-river font-semibold mb-2 uppercase">Raw Events ({inc.events?.length || 0})</div>
                          <div className="max-h-48 overflow-y-auto space-y-1">
                            {inc.events?.map((e, idx) => (
                              <div key={idx} className="flex gap-4 text-xs font-mono p-1 hover:bg-villa/30 rounded">
                                <span className="text-river w-20">{new Date(e.timestamp).toLocaleTimeString()}</span>
                                <span className="text-ocean font-bold w-16">{e.event_type}</span>
                                <span className="text-ocean flex-1 truncate">{e.filename || e.comm}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {incidents.length === 0 && (
                    <div className="text-center py-10 text-river">No incidents recorded yet.</div>
                  )}
                </div>
              </div>
            </div>
          )}

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
