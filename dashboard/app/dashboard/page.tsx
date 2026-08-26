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
  Play,
  Settings,
  HelpCircle,
  RefreshCw,
  X,
  Server,
  Radio,
  Cpu,
  Menu,
} from "lucide-react";

const DEFAULT_WS_URL = "ws://localhost:8765";

export default function DashboardPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState<ProcessNode | NetworkNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<EventEdge>([]);
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [wsUrl, setWsUrl] = useState(DEFAULT_WS_URL);
  const [customWsUrl, setCustomWsUrl] = useState(DEFAULT_WS_URL);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showSimMenu, setShowSimMenu] = useState(false);

  // Mobile Active View Mode ('graph' | 'threats' | 'events' | 'menu')
  const [mobileView, setMobileView] = useState<"graph" | "threats" | "events" | "menu">("graph");

  const [eventLogs, setEventLogs] = useState<KernelEvent[]>([]);
  const [narrations, setNarrations] = useState<NarrationMessage[]>([]);
  const [riskData, setRiskData] = useState<RiskScoreData | null>({
    score: 0,
    file_opens: 0,
    processes_spawned: 0,
    network_connections: 0,
    anomalies: ["Monitoring active"],
  });
  const [incidents, setIncidents] = useState<IncidentData[]>([]);
  const [activeTab, setActiveTab] = useState<"graph" | "timeline" | "events" | "analytics" | "network">("graph");
  const [timelineSearch, setTimelineSearch] = useState("");
  const [expandedIncident, setExpandedIncident] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const wsRef = useRef<WebSocket | null>(null);
  const [clock, setClock] = useState("");

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const sendKillCommand = useCallback((pid: number) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log(`[KILL ACTION] Sending kill message for PID ${pid}`);
      wsRef.current.send(JSON.stringify({ action: "kill", pid }));
    } else {
      // In-browser fallback kill for demo/simulation mode
      console.log(`[SIMULATED KILL ACTION] Terminating PID ${pid}`);
      setNodes((prevNodes: (ProcessNode | NetworkNode)[]) =>
        prevNodes.map((n: any) =>
          n.type === "processNode" && n.data.pid === pid
            ? { ...n, data: { ...n.data, isKilled: true } }
            : n
        )
      );
    }
  }, [setNodes]);

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
              style: { stroke: "#ef4444", strokeWidth: 2.5, strokeDasharray: "5,5" },
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

        const strokeColor = isDotEnv ? "#ef4444" : "#ffffff";

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
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionStatus("connected");
        try {
          ws.send(JSON.stringify({ action: "get_history", limit: 50 }));
        } catch (err) {
          // ignore
        }
      };
      ws.onclose = () => {
        setConnectionStatus("disconnected");
      };
      ws.onerror = () => {
        setConnectionStatus("disconnected");
      };

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
  }, [wsUrl, handleIncomingEvent, handleKillResult]);

  // Interactive In-Browser Simulation Triggers
  const runSimulationScenario = (scenario: "typosquat" | "env_theft" | "shell_spawn" | "full_chain") => {
    setShowSimMenu(false);
    const now = new Date().toISOString();

    if (scenario === "typosquat" || scenario === "full_chain") {
      const evt1: KernelEvent = {
        timestamp: now,
        pid: 3010,
        ppid: 1000,
        uid: 1000,
        comm: "npm",
        event_type: "exec_spawn",
        filename: "npm install aegis-utils",
        severity: "low",
        attack_type: "TYPOSQUATTING",
      };
      handleIncomingEvent(evt1);

      setNarrations((prev) => [
        {
          type: "narration",
          pid: 3010,
          text: "⚠️ Typosquat package `aegis-utils` resolved during `npm install`",
          attack_type: "TYPOSQUATTING",
          timestamp: now,
        },
        ...prev,
      ]);
      setRiskData({ score: 45, file_opens: 1, processes_spawned: 1, network_connections: 0, anomalies: ["Typosquat package loaded", "Postinstall hook active"] });
    }

    if (scenario === "env_theft" || scenario === "full_chain") {
      setTimeout(() => {
        const time2 = new Date().toISOString();
        const evt2: KernelEvent = {
          timestamp: time2,
          pid: 5820,
          ppid: 3010,
          uid: 1000,
          comm: "node",
          event_type: "file_open",
          filename: "simulator/target-app/.env",
          severity: "critical",
          attack_type: "CREDENTIAL_THEFT",
        };
        handleIncomingEvent(evt2);

        const evt3: KernelEvent = {
          timestamp: time2,
          pid: 5820,
          ppid: 3010,
          uid: 1000,
          comm: "node",
          event_type: "network",
          filename: "127.0.0.1:9999",
          severity: "high",
          dest_ip: "127.0.0.1",
          dest_port: 9999,
          threat: true,
          attack_type: "DATA_EXFILTRATION",
        };
        handleIncomingEvent(evt3);

        setNarrations((prev) => [
          {
            type: "narration",
            pid: 5820,
            text: "🚨 CRITICAL: Node process accessed .env secrets and initiated outbound HTTP POST to port 9999",
            attack_type: "CREDENTIAL_THEFT",
            timestamp: time2,
          },
          ...prev,
        ]);
        setRiskData({ score: 95, file_opens: 2, processes_spawned: 2, network_connections: 1, anomalies: ["Unauthorized .env Read", "C2 Exfiltration Active", "AWS Keys Leaked"] });
      }, 1200);
    }

    if (scenario === "shell_spawn" || scenario === "full_chain") {
      setTimeout(() => {
        const time3 = new Date().toISOString();
        const evt4: KernelEvent = {
          timestamp: time3,
          pid: 8940,
          ppid: 5820,
          uid: 1000,
          comm: "bash",
          event_type: "exec_spawn",
          filename: "bash -c id",
          severity: "medium",
          attack_type: "REVERSE_SHELL",
        };
        handleIncomingEvent(evt4);

        setNarrations((prev) => [
          {
            type: "narration",
            pid: 8940,
            text: "⚠️ Reverse shell reconnaissance process `bash -c id` spawned by node postinstall",
            attack_type: "REVERSE_SHELL",
            timestamp: time3,
          },
          ...prev,
        ]);
      }, 2400);
    }
  };

  const clearSimulation = () => {
    setNodes([]);
    setEdges([]);
    setEventLogs([]);
    setNarrations([]);
    setRiskData({ score: 0, file_opens: 0, processes_spawned: 0, network_connections: 0, anomalies: ["System Monitoring Clean"] });
    setIncidents([]);
  };

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
    <div className="w-screen h-screen bg-[#0b0c0f] text-white p-1.5 sm:p-3 flex items-center justify-center font-sans overflow-hidden select-none relative">
      {/* Outer Spacious Frame */}
      <div className="p-2 sm:p-2.5 bg-[#e5e7eb] rounded-2xl sm:rounded-[2.8rem] shadow-[0_0_100px_rgba(0,0,0,0.95)] w-full max-w-[99vw] h-[98vh] relative overflow-hidden flex flex-col justify-between z-10">
        
        {/* Inner Jet Black Panel */}
        <div className="bg-[#09090b] rounded-xl sm:rounded-[2.3rem] p-2.5 sm:p-4 flex flex-col lg:flex-row w-full h-full relative overflow-hidden text-white border border-white/10 gap-3">

          {/* ─── Column 1: Left Sidebar (Desktop & Mobile Menu) ─── */}
          <aside className={`w-full lg:w-60 bg-white/5 border border-white/10 rounded-3xl flex-col shrink-0 z-20 overflow-hidden backdrop-blur-xl ${mobileView === "menu" ? "flex" : "hidden lg:flex"}`}>
            {/* App Identity Header */}
            <div className="p-3.5 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="bg-white text-black font-cyber font-black text-xs px-3.5 py-1.5 rounded-full tracking-wider shadow-md flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 fill-current text-black" />
                  <span>AEGIS</span>
                  <span className="text-[8px] bg-black text-white px-1.5 py-0.5 rounded-full font-mono">v1.0</span>
                </div>
              </div>
              <p className="text-[9px] text-slate-400 font-mono mt-1.5 pl-1">eBPF Supply Chain Defense</p>
            </div>

            {/* Navigation Tabs */}
            <nav className="flex-1 px-2.5 py-3 space-y-1.5 font-mono text-xs">
              <button
                onClick={() => { setActiveTab("graph"); setMobileView("graph"); }}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl font-cyber font-bold transition-all ${
                  activeTab === "graph"
                    ? "bg-white text-black shadow-lg"
                    : "text-slate-400 hover:text-white hover:bg-white/10"
                }`}
              >
                <Eye className="w-4 h-4" />
                <span>Process Graph</span>
              </button>

              <button
                onClick={() => { setActiveTab("timeline"); setMobileView("graph"); }}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl font-cyber font-bold transition-all ${
                  activeTab === "timeline"
                    ? "bg-white text-black shadow-lg"
                    : "text-slate-400 hover:text-white hover:bg-white/10"
                }`}
              >
                <Activity className="w-4 h-4" />
                <span>Incident Timeline</span>
              </button>

              <button
                onClick={() => { setActiveTab("analytics"); setMobileView("graph"); }}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl font-cyber font-bold transition-all ${
                  activeTab === "analytics"
                    ? "bg-white text-black shadow-lg"
                    : "text-slate-400 hover:text-white hover:bg-white/10"
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>Security Analytics</span>
              </button>

              <button
                onClick={() => { setActiveTab("network"); setMobileView("graph"); }}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl font-cyber font-bold transition-all ${
                  activeTab === "network"
                    ? "bg-white text-black shadow-lg"
                    : "text-slate-400 hover:text-white hover:bg-white/10"
                }`}
              >
                <Network className="w-4 h-4" />
                <span>Network Topology</span>
              </button>
            </nav>

            {/* Risk Score Gauge */}
            <div className="pb-2 border-t border-white/10 pt-2">
              <RiskGauge data={riskData} />
            </div>

            {/* Sidebar Footer */}
            <div className="px-3.5 py-2.5 border-t border-white/10 text-[9px] text-slate-400 font-mono space-y-1 bg-black/40">
              <div className="flex justify-between">
                <span>Probes:</span>
                <span className="text-white font-bold">openat · execve</span>
              </div>
              <div className="flex justify-between">
                <span>Target:</span>
                <span className="text-slate-200 font-mono truncate max-w-[100px]" title={wsUrl}>
                  {wsUrl}
                </span>
              </div>
            </div>
          </aside>

          {/* ─── Main Workspace Area ─── */}
          <div className="flex-1 flex flex-col min-w-0 h-full">
            {/* Top Navigation Header Bar */}
            <header className="relative z-50 bg-white/5 border border-white/10 rounded-2xl px-3 sm:px-4 py-2 flex items-center justify-between shrink-0 mb-2 font-mono text-xs backdrop-blur-xl">
              {/* Left Live Metrics (Responsive) */}
              <div className="flex items-center gap-2 sm:gap-3 text-[11px] sm:text-xs">
                <div className="flex items-center gap-1">
                  <Cpu className="w-3.5 h-3.5 text-white" />
                  <span className="hidden sm:inline text-slate-400">Processes:</span>
                  <span className="font-cyber font-black text-white">{processCount}</span>
                </div>
                <span className="text-slate-700">|</span>
                <div className="flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-red-400 animate-pulse" />
                  <span className="hidden sm:inline text-slate-400">Compromised:</span>
                  <span className="font-cyber font-black text-red-400">{compromisedCount}</span>
                </div>
                <span className="text-slate-700">|</span>
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline text-slate-400">Killed:</span>
                  <span className="font-cyber font-black text-emerald-400">{terminatedCount}</span>
                </div>
              </div>

              {/* Center Clock (Desktop) */}
              <div className="hidden md:block text-slate-300 font-mono font-bold tracking-widest bg-white/10 px-3 py-0.5 rounded-full border border-white/15 text-[11px]">
                {clock}
              </div>

              {/* Right Action Bar */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="relative">
                  <button
                    onClick={() => setShowSimMenu(!showSimMenu)}
                    className="flex items-center gap-1.5 bg-white hover:bg-orange-500 hover:text-white text-black font-cyber font-black px-3 sm:px-4 py-1 rounded-full text-[11px] sm:text-xs shadow-lg transition-all"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>SIMULATE</span>
                  </button>

                  {showSimMenu && (
                    <>
                      {/* Click-away backdrop to close menu */}
                      <div
                        className="fixed inset-0 z-40 bg-transparent"
                        onClick={() => setShowSimMenu(false)}
                      />
                      <div className="absolute right-0 mt-2 w-64 bg-[#10121a] border border-white/30 rounded-2xl p-2 shadow-[0_20px_50px_rgba(0,0,0,0.95)] z-50 font-mono text-xs space-y-1">
                        <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 border-b border-white/10 uppercase tracking-wider">
                          Interactive In-Browser Scenarios
                        </div>
                        <button
                          onClick={() => {
                            runSimulationScenario("full_chain");
                            setShowSimMenu(false);
                          }}
                          className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/10 text-white transition-colors flex items-center gap-2"
                        >
                          <Flame className="w-3.5 h-3.5 text-red-400" />
                          <span>Run Full Attack Chain</span>
                        </button>
                        <button
                          onClick={() => {
                            runSimulationScenario("env_theft");
                            setShowSimMenu(false);
                          }}
                          className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/10 text-white transition-colors flex items-center gap-2"
                        >
                          <Shield className="w-3.5 h-3.5 text-orange-400" />
                          <span>.env Credential Theft</span>
                        </button>
                        <button
                          onClick={() => {
                            runSimulationScenario("shell_spawn");
                            setShowSimMenu(false);
                          }}
                          className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/10 text-white transition-colors flex items-center gap-2"
                        >
                          <Terminal className="w-3.5 h-3.5 text-white" />
                          <span>Reverse Shell Spawn</span>
                        </button>
                        <div className="border-t border-white/10 my-1"></div>
                        <button
                          onClick={() => {
                            clearSimulation();
                            setShowSimMenu(false);
                          }}
                          className="w-full text-left px-3 py-2 rounded-xl hover:bg-red-950/60 hover:text-red-300 text-slate-400 transition-colors flex items-center gap-2"
                        >
                          <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                          <span>Reset Canvas & State</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>

                <button
                  onClick={() => setShowSettingsModal(true)}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/10 hover:bg-white hover:text-black border border-white/20 flex items-center justify-center transition-all"
                  title="Settings"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => setShowHelpModal(true)}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/10 hover:bg-white hover:text-black border border-white/20 flex items-center justify-center transition-all"
                  title="Guide"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => exportReportToHTML(incidents)}
                  className="hidden sm:flex items-center gap-1.5 bg-white/10 hover:bg-white hover:text-black border border-white/20 text-white px-3 py-1 rounded-full font-cyber font-bold transition-all text-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>REPORT</span>
                </button>
              </div>
            </header>

            {/* ─── Mobile View Selector Bar (< lg) ─── */}
            <div className="flex lg:hidden items-center justify-between gap-1 bg-white/5 border border-white/10 p-1 rounded-2xl mb-2 text-[10px] font-mono shrink-0 backdrop-blur-md">
              <button
                onClick={() => setMobileView("graph")}
                className={`flex-1 py-1.5 rounded-xl font-cyber font-bold transition-all text-center ${
                  mobileView === "graph" ? "bg-white text-black shadow-md" : "text-slate-300 hover:text-white"
                }`}
              >
                🎨 GRAPH
              </button>
              <button
                onClick={() => setMobileView("threats")}
                className={`flex-1 py-1.5 rounded-xl font-cyber font-bold transition-all text-center relative ${
                  mobileView === "threats" ? "bg-white text-black shadow-md" : "text-slate-300 hover:text-white"
                }`}
              >
                <span>⚠️ THREATS</span>
                {narrations.length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-red-500 absolute top-1 right-1 animate-pulse" />
                )}
              </button>
              <button
                onClick={() => setMobileView("events")}
                className={`flex-1 py-1.5 rounded-xl font-cyber font-bold transition-all text-center ${
                  mobileView === "events" ? "bg-white text-black shadow-md" : "text-slate-300 hover:text-white"
                }`}
              >
                ⚡ EVENTS
              </button>
              <button
                onClick={() => setMobileView("menu")}
                className={`flex-1 py-1.5 rounded-xl font-cyber font-bold transition-all text-center ${
                  mobileView === "menu" ? "bg-white text-black shadow-md" : "text-slate-300 hover:text-white"
                }`}
              >
                📋 MENU
              </button>
            </div>

            {/* Critical Alert Banner */}
            {compromisedCount > 0 && terminatedCount < compromisedCount && (
              <div className="bg-red-950/80 border border-red-800 px-3 py-1.5 rounded-2xl flex items-center justify-between mb-2 animate-pulse font-mono text-[11px] text-red-200 font-bold">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <span className="truncate">`.env` credential theft! Click KILL [PID] on node.</span>
                </div>
              </div>
            )}

            {/* ─── Main View Switcher ─── */}
            <div className="flex flex-1 overflow-hidden gap-3 h-full">
              {activeTab === "graph" && (
                <>
                  {/* ─── Column 2: Center - Spacious Process Graph Canvas ─── */}
                  <div className={`flex-1 flex flex-col min-w-0 relative h-full ${mobileView === "graph" ? "flex" : "hidden lg:flex"}`}>
                    <div className="flex-1 bg-black/70 border border-white/10 rounded-3xl overflow-hidden flex flex-col relative shadow-2xl h-full">
                      {connectionStatus === "disconnected" && nodes.length === 0 && (
                        <div className="absolute inset-0 z-40 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center gap-3 p-4 text-center">
                          <Server className="w-8 h-8 text-white animate-pulse" />
                          <h3 className="text-sm font-cyber font-black text-white uppercase">Live eBPF Daemon Offline</h3>
                          <p className="text-[11px] text-slate-300 max-w-md font-sans">
                            You are viewing hosted app. Click <strong className="text-white">SIMULATE</strong> above to run in-browser attack.
                          </p>
                          <div className="flex items-center gap-2 mt-1 font-mono">
                            <button
                              onClick={() => runSimulationScenario("full_chain")}
                              className="bg-white hover:bg-orange-500 hover:text-white text-black font-cyber font-black px-4 py-2 rounded-full text-xs shadow-lg transition-all"
                            >
                              Try In-Browser Simulation
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="flex-1 relative h-full">
                        <FlowGraph
                          nodes={nodes}
                          edges={edges}
                          onNodesChange={onNodesChange}
                          onEdgesChange={onEdgesChange}
                        />
                      </div>
                    </div>
                  </div>

                  {/* ─── Column 3: Dedicated Behavioral Threat Intelligence ─── */}
                  <div className={`w-full lg:w-72 xl:w-80 glass-panel border border-white/10 rounded-3xl flex-col shrink-0 overflow-hidden h-full ${mobileView === "threats" ? "flex" : "hidden lg:flex"}`}>
                    <ThreatPanel narrations={narrations} />
                  </div>
                </>
              )}

              {activeTab === "timeline" && (
                <div className="flex-1 p-4 overflow-y-auto bg-black/40 border border-white/10 rounded-3xl font-mono h-full">
                  <div className="max-w-4xl mx-auto space-y-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
                      <div>
                        <h2 className="text-base font-cyber font-black text-white uppercase tracking-wide">Incident Timeline</h2>
                        <p className="text-xs text-slate-400 font-sans">Audit trail of supply chain attacks</p>
                      </div>
                      <div className="relative w-full sm:w-64">
                        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          placeholder="Filter attack type or PID..."
                          value={timelineSearch}
                          onChange={(e) => setTimelineSearch(e.target.value)}
                          className="w-full bg-white/5 border border-white/20 rounded-2xl pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-white"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      {incidents.filter(inc => 
                        inc.attack_type.toLowerCase().includes(timelineSearch.toLowerCase()) || 
                        inc.pid.toString().includes(timelineSearch)
                      ).map((inc) => (
                        <div key={inc.id} className="glass-card border border-white/10 rounded-2xl overflow-hidden cursor-pointer hover:border-white/40 transition-all" onClick={() => setExpandedIncident(expandedIncident === inc.id ? null : inc.id)}>
                          <div className="flex items-center p-4 border-l-4 border-l-white">
                            <div className="flex-1 flex items-center gap-4">
                              <span className="bg-red-950 border border-red-800 text-red-300 text-xs font-cyber font-black px-3 py-1 rounded-full uppercase">{inc.attack_type}</span>
                              <span className="text-xs font-bold text-white">PID: {inc.pid}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-cyber font-bold text-orange-400">Risk: {inc.risk_score}</span>
                            </div>
                          </div>
                          
                          {expandedIncident === inc.id && (
                            <div className="p-4 border-t border-white/10 bg-black/80 text-xs space-y-2">
                              {inc.narration_text && (
                                <div className="p-3 bg-white/5 border-l-2 border-white text-slate-200 rounded-r-xl">
                                  <strong className="text-white font-cyber">Narrative:</strong> {inc.narration_text}
                                </div>
                              )}
                              <div className="max-h-48 overflow-y-auto space-y-1">
                                {inc.events?.map((e, idx) => (
                                  <div key={idx} className="flex gap-2 text-xs font-mono p-1.5 hover:bg-white/10 rounded-lg text-slate-300">
                                    <span className="text-white font-bold">{e.event_type}</span>
                                    <span className="text-slate-200 truncate">{e.filename || e.comm}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "analytics" && (
                <div className="flex-1 p-4 overflow-y-auto bg-black/40 border border-white/10 rounded-3xl font-mono h-full">
                  <div className="max-w-4xl mx-auto space-y-4">
                    <h2 className="text-base font-cyber font-black text-white uppercase tracking-wide">Security Analytics</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="glass-card p-4 rounded-2xl border border-white/10">
                        <p className="text-xs text-slate-400 font-bold">Total Syscalls</p>
                        <p className="text-2xl font-cyber font-black text-white mt-1">{eventLogs.length}</p>
                      </div>
                      <div className="glass-card p-4 rounded-2xl border border-white/10">
                        <p className="text-xs text-slate-400 font-bold">Compromised</p>
                        <p className="text-2xl font-cyber font-black text-red-400 mt-1">{compromisedCount}</p>
                      </div>
                      <div className="glass-card p-4 rounded-2xl border border-white/10">
                        <p className="text-xs text-slate-400 font-bold">Terminated</p>
                        <p className="text-2xl font-cyber font-black text-emerald-400 mt-1">{terminatedCount}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "network" && (
                <div className="flex-1 p-4 overflow-y-auto bg-black/40 border border-white/10 rounded-3xl font-mono h-full">
                  <div className="max-w-4xl mx-auto space-y-4">
                    <h2 className="text-base font-cyber font-black text-white uppercase tracking-wide">Network Topology</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="glass-card p-4 rounded-2xl border border-white/10">
                        <h3 className="text-xs font-bold text-slate-300 uppercase">Active Sockets</h3>
                        <div className="text-2xl font-cyber font-black text-white mt-1">{networkConnections}</div>
                      </div>
                      <div className="glass-card p-4 rounded-2xl border border-white/10">
                        <h3 className="text-xs font-bold text-slate-300 uppercase">Suspicious Endpoints</h3>
                        <div className="text-2xl font-cyber font-black text-red-400 mt-1">{threatsDetected}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ─── Column 4: Dedicated Live Event Stream Sidebar ─── */}
              <div className={`w-full lg:w-64 xl:w-72 glass-panel border border-white/10 rounded-3xl flex-col shrink-0 overflow-hidden h-full ${mobileView === "events" ? "flex" : "hidden lg:flex"}`}>
                {/* Sidebar Header */}
                <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between bg-white/5 font-mono">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-orange-500" />
                    <span className="text-xs font-cyber font-bold text-white uppercase tracking-wider">Live Event Stream</span>
                  </div>
                  <span className="text-[10px] bg-white/10 border border-white/20 px-2 py-0.5 rounded-full text-white font-bold font-mono">
                    {filteredLogs.length} live
                  </span>
                </div>

                {/* Search & Filter */}
                <div className="p-3 border-b border-white/10 space-y-2 bg-black/40">
                  <div className="relative font-mono">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search PID, comm, path..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-white/5 border border-white/20 rounded-2xl pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-white"
                    />
                  </div>

                  <div className="flex items-center gap-1 text-[10px] font-mono">
                    <Filter className="w-3 h-3 text-slate-500" />
                    {["all", "critical", "high", "medium"].map((sev) => (
                      <button
                        key={sev}
                        onClick={() => setFilterSeverity(sev)}
                        className={`px-2 py-0.5 rounded-full uppercase font-bold transition-colors ${
                          filterSeverity === sev
                            ? "bg-white text-black shadow-sm"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        {sev}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Event Feed List */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2 text-xs font-mono">
                  {filteredLogs.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2">
                      <Terminal className="w-6 h-6 text-slate-600" />
                      <p className="text-center text-xs text-slate-400">Awaiting kernel events...</p>
                    </div>
                  ) : (
                    filteredLogs.map((evt: KernelEvent, idx: number) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-2xl border text-xs transition-all glass-card ${
                          evt.severity === "critical"
                            ? "border-red-500/80 bg-red-950/30 text-red-200"
                            : evt.severity === "high"
                            ? "border-orange-500/80 bg-orange-950/30 text-orange-200"
                            : "border-white/10 bg-black/60 text-slate-300"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1 font-bold">
                          <span
                            className={`uppercase text-[9px] tracking-wider px-2 py-0.5 rounded-full font-cyber font-black ${
                              evt.severity === "critical"
                                ? "bg-red-900/80 text-red-300 border border-red-700"
                                : evt.severity === "high"
                                ? "bg-orange-900/80 text-orange-300 border border-orange-700"
                                : "bg-white/10 text-white border border-white/20"
                            }`}
                          >
                            {evt.event_type}
                          </span>
                          <span className="text-[10px] text-slate-400">PID {evt.pid}</span>
                        </div>

                        <div className="truncate text-white font-medium my-1" title={evt.filename}>
                          {evt.filename}
                        </div>

                        <div className="text-[10px] text-slate-400 flex justify-between pt-1 border-t border-white/10">
                          <span>comm: <strong className="text-white">{evt.comm}</strong></span>
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
      </div>

      {/* ─── Daemon Settings Modal ─── */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0e0e11] border border-white/20 rounded-3xl p-5 sm:p-6 max-w-md w-full font-mono text-xs space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-sm font-cyber font-bold text-white uppercase">
                <Settings className="w-4 h-4" />
                <span>Daemon Connection</span>
              </div>
              <button onClick={() => setShowSettingsModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-slate-400 font-bold block">WebSocket Address:</label>
              <input
                type="text"
                value={customWsUrl}
                onChange={(e) => setCustomWsUrl(e.target.value)}
                className="w-full bg-white/5 border border-white/20 rounded-2xl p-3 text-white focus:outline-none focus:border-white font-mono"
                placeholder="ws://localhost:8765"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setWsUrl(customWsUrl);
                  setShowSettingsModal(false);
                }}
                className="bg-white hover:bg-orange-500 hover:text-white text-black font-cyber font-black px-5 py-2.5 rounded-full text-xs shadow-lg transition-all"
              >
                Save & Connect
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Guide Modal ─── */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0e0e11] border border-white/20 rounded-3xl p-5 sm:p-6 max-w-lg w-full font-mono text-xs space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-sm font-cyber font-bold text-white uppercase">
                <HelpCircle className="w-4 h-4" />
                <span>How to Run Simulation</span>
              </div>
              <button onClick={() => setShowHelpModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-slate-300 font-sans leading-relaxed text-xs">
              <p>Run these 3 terminals locally to test the eBPF kernel detector:</p>
              <div className="space-y-2 font-mono text-[11px]">
                <div className="bg-white/5 p-3 rounded-2xl border border-white/10">
                  <div className="text-white font-bold mb-1 font-cyber">1. C2 Exfil Listener</div>
                  <code>python simulator/listener.py</code>
                </div>

                <div className="bg-white/5 p-3 rounded-2xl border border-white/10">
                  <div className="text-white font-bold mb-1 font-cyber">2. eBPF Daemon (Root)</div>
                  <code>sudo python3 ebpf/daemon.py</code>
                </div>

                <div className="bg-white/5 p-3 rounded-2xl border border-white/10">
                  <div className="text-white font-bold mb-1 font-cyber">3. Trigger Attack</div>
                  <code>cd simulator/target-app && npm install --foreground-scripts</code>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowHelpModal(false)}
                className="bg-white text-black font-cyber font-bold px-5 py-2.5 rounded-full text-xs"
              >
                Close Guide
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
