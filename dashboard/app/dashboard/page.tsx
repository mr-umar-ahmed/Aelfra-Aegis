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
  Skull,
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

  const [eventLogs, setEventLogs] = useState<KernelEvent[]>([]);
  const [narrations, setNarrations] = useState<NarrationMessage[]>([]);
  const [riskData, setRiskData] = useState<RiskScoreData | null>({
    score: 0,
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

        const strokeColor = isDotEnv ? "#ef4444" : "#38bdf8";

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
      setRiskData({ score: 45, anomalies: ["Typosquat package loaded", "Postinstall hook active"] });
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
        setRiskData({ score: 95, anomalies: ["Unauthorized .env Read", "C2 Exfiltration Active", "AWS Keys Leaked"] });
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
    setRiskData({ score: 0, anomalies: ["System Monitoring Clean"] });
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
    <div className="flex h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans select-none">
      {/* ─── Left Sidebar (250px) ─── */}
      <aside className="w-64 glass-panel flex flex-col shrink-0 border-r border-slate-800 z-20 shadow-2xl">
        {/* App Identity */}
        <div className="px-5 py-5 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 shadow-lg shadow-cyan-500/30 border border-cyan-400/30">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-black text-xl tracking-wider text-slate-100 font-mono flex items-center gap-1.5">
                AEGIS <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800">v1.0</span>
              </h1>
              <p className="text-[11px] text-slate-400 font-mono">eBPF Supply Chain Defense</p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 font-mono text-xs">
          <button
            onClick={() => setActiveTab("graph")}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-semibold transition-all ${
              activeTab === "graph"
                ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-md shadow-cyan-500/10"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
            }`}
          >
            <Eye className="w-4 h-4" />
            <span>Process Graph</span>
          </button>
          <button
            onClick={() => setActiveTab("timeline")}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-semibold transition-all ${
              activeTab === "timeline"
                ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-md shadow-cyan-500/10"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Incident Timeline</span>
          </button>
          <button
            onClick={() => setActiveTab("analytics")}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-semibold transition-all ${
              activeTab === "analytics"
                ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-md shadow-cyan-500/10"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Security Analytics</span>
          </button>
          <button
            onClick={() => setActiveTab("network")}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-semibold transition-all ${
              activeTab === "network"
                ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-md shadow-cyan-500/10"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
            }`}
          >
            <Network className="w-4 h-4" />
            <span>Network Topology</span>
          </button>
        </nav>

        {/* Risk Score Gauge */}
        <div className="pb-4 border-t border-slate-800/80 pt-3">
          <RiskGauge data={riskData} />
        </div>

        {/* Sidebar Footer */}
        <div className="px-4 py-3.5 border-t border-slate-800/80 text-[10px] text-slate-400 font-mono space-y-1 bg-slate-950/60">
          <div className="flex justify-between">
            <span>Kernel Probes:</span>
            <span className="text-cyan-400 font-bold">openat · execve</span>
          </div>
          <div className="flex justify-between">
            <span>Daemon Target:</span>
            <span className="text-slate-200 font-mono truncate max-w-[110px]" title={wsUrl}>
              {wsUrl}
            </span>
          </div>
        </div>
      </aside>

      {/* ─── Main Content Area ─── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* ─── Top Navigation Header ─── */}
        <header className="h-16 glass-panel border-b border-slate-800 px-6 flex items-center justify-between shrink-0 z-20">
          {/* Left Metrics */}
          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <span className="text-slate-400">Processes:</span>
              <span className="font-extrabold text-cyan-400 text-sm">{processCount}</span>
            </div>
            <span className="text-slate-800">|</span>
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-red-400 animate-pulse" />
              <span className="text-slate-400">Compromised:</span>
              <span className="font-extrabold text-red-400 text-sm">{compromisedCount}</span>
            </div>
            <span className="text-slate-800">|</span>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-slate-400">Killed:</span>
              <span className="font-extrabold text-emerald-400 text-sm">{terminatedCount}</span>
            </div>
          </div>

          {/* Center: Live Clock */}
          <div className="text-slate-400 text-xs font-mono font-bold tracking-widest bg-slate-900/80 px-3.5 py-1.5 rounded-xl border border-slate-800 shadow-inner">
            {clock}
          </div>

          {/* Right Action Bar */}
          <div className="flex items-center gap-3">
            {/* Interactive Simulation Trigger Button */}
            <div className="relative">
              <button
                onClick={() => setShowSimMenu(!showSimMenu)}
                className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black px-3.5 py-2 rounded-xl text-xs shadow-lg shadow-cyan-500/20 active:scale-95 transition-all font-mono"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>SIMULATE ATTACK</span>
              </button>

              {showSimMenu && (
                <div className="absolute right-0 mt-2 w-64 glass-panel border border-slate-700 rounded-2xl p-2 shadow-2xl z-50 font-mono text-xs space-y-1">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 border-b border-slate-800 uppercase tracking-wider">
                    Interactive In-Browser Scenarios
                  </div>
                  <button
                    onClick={() => runSimulationScenario("full_chain")}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-cyan-500/20 hover:text-cyan-400 text-slate-200 transition-colors flex items-center gap-2"
                  >
                    <Flame className="w-3.5 h-3.5 text-red-400" />
                    <span>Run Full Attack Chain</span>
                  </button>
                  <button
                    onClick={() => runSimulationScenario("env_theft")}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-cyan-500/20 hover:text-cyan-400 text-slate-200 transition-colors flex items-center gap-2"
                  >
                    <Shield className="w-3.5 h-3.5 text-amber-400" />
                    <span>.env Credential Theft</span>
                  </button>
                  <button
                    onClick={() => runSimulationScenario("shell_spawn")}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-cyan-500/20 hover:text-cyan-400 text-slate-200 transition-colors flex items-center gap-2"
                  >
                    <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Reverse Shell Spawn</span>
                  </button>
                  <div className="border-t border-slate-800 my-1"></div>
                  <button
                    onClick={clearSimulation}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-red-950/60 hover:text-red-300 text-slate-400 transition-colors flex items-center gap-2"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                    <span>Reset Canvas & State</span>
                  </button>
                </div>
              )}
            </div>

            {/* Daemon Settings & Help Modals */}
            <button
              onClick={() => setShowSettingsModal(true)}
              className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-xl transition-all"
              title="WebSocket Connection Settings"
            >
              <Settings className="w-4 h-4" />
            </button>

            <button
              onClick={() => setShowHelpModal(true)}
              className="p-2 bg-slate-900 hover:bg-slate-800 text-cyan-400 border border-slate-800 rounded-xl transition-all"
              title="How to Run Locally"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            {/* Export HTML Report */}
            <button
              onClick={() => exportReportToHTML(incidents)}
              className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 px-3 py-2 rounded-xl text-xs font-mono font-bold transition-all"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>REPORT</span>
            </button>

            {/* Connection Pill */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-900/90 font-mono text-xs">
              <Radio className={`w-3.5 h-3.5 ${connectionStatus === "connected" ? "text-emerald-400 animate-pulse" : "text-amber-400"}`} />
              <span className="font-bold text-slate-200 uppercase text-[10px] tracking-wider">{connectionStatus}</span>
            </div>
          </div>
        </header>

        {/* Critical Alert Banner */}
        {compromisedCount > 0 && terminatedCount < compromisedCount && (
          <div className="bg-gradient-to-r from-red-950 via-red-900 to-red-950 border-b border-red-800/80 px-6 py-2 flex items-center justify-between shrink-0 animate-pulse">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-red-200">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span>SECURITY ALERT: `.env` credential theft detected! Click KILL [PID] on compromised nodes to send SIGKILL.</span>
            </div>
          </div>
        )}

        {/* ─── Main View Switcher ─── */}
        <div className="flex flex-1 overflow-hidden">
          {activeTab === "graph" && (
            <div className="flex-1 flex flex-col min-w-0 relative">
              {/* React Flow Graph Canvas */}
              <div className="flex-1 m-3 bg-slate-950/60 border border-slate-800/80 rounded-2xl overflow-hidden flex flex-col relative shadow-inner">
                {connectionStatus === "disconnected" && nodes.length === 0 && (
                  <div className="absolute inset-0 z-40 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center gap-3 p-6 text-center">
                    <Server className="w-10 h-10 text-cyan-400 animate-pulse" />
                    <h3 className="text-base font-bold text-slate-100 font-mono">Live eBPF Daemon Offline</h3>
                    <p className="text-xs text-slate-400 max-w-md">
                      You are viewing the hosted dashboard at <code className="text-cyan-400">aelfra-aegis.vercel.app</code>. Click <strong className="text-cyan-400">SIMULATE ATTACK</strong> above to run an in-browser attack scenario, or connect your local daemon on <code className="text-cyan-400">ws://localhost:8765</code>.
                    </p>
                    <div className="flex items-center gap-3 mt-2 font-mono">
                      <button
                        onClick={() => runSimulationScenario("full_chain")}
                        className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black px-4 py-2 rounded-xl text-xs shadow-lg shadow-cyan-500/20"
                      >
                        Try In-Browser Simulation
                      </button>
                      <button
                        onClick={() => setShowHelpModal(true)}
                        className="bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold px-4 py-2 rounded-xl text-xs"
                      >
                        How to Connect Local Daemon
                      </button>
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
            </div>
          )}

          {activeTab === "timeline" && (
            <div className="flex-1 p-6 overflow-y-auto bg-slate-950/50 font-mono">
              <div className="max-w-4xl mx-auto space-y-4">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-black text-slate-100 uppercase tracking-wide">Incident Provenance Timeline</h2>
                    <p className="text-xs text-slate-400">Causal audit trail of all detected supply chain attacks</p>
                  </div>
                  <div className="relative w-64">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Filter attack type or PID..."
                      value={timelineSearch}
                      onChange={(e) => setTimelineSearch(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  {incidents.filter(inc => 
                    inc.attack_type.toLowerCase().includes(timelineSearch.toLowerCase()) || 
                    inc.pid.toString().includes(timelineSearch)
                  ).map((inc) => (
                    <div key={inc.id} className="glass-card border border-slate-800 rounded-2xl overflow-hidden cursor-pointer hover:border-slate-700 transition-all" onClick={() => setExpandedIncident(expandedIncident === inc.id ? null : inc.id)}>
                      <div className="flex items-center p-4 border-l-4 border-l-cyan-500">
                        <div className="flex-1 flex items-center gap-4">
                          <span className="bg-red-950 border border-red-800 text-red-300 text-xs font-black px-2.5 py-1 rounded-lg uppercase">{inc.attack_type}</span>
                          <span className="text-xs font-bold text-slate-200">PID: {inc.pid}</span>
                          <span className="text-xs text-slate-500">{new Date(inc.start_time).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-xs font-extrabold text-amber-400">Risk Score: {inc.risk_score}</span>
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${inc.status === 'terminated' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-red-950 text-red-400 border border-red-800'}`}>{inc.status.toUpperCase()}</span>
                        </div>
                      </div>
                      
                      {expandedIncident === inc.id && (
                        <div className="p-4 border-t border-slate-800/80 bg-slate-950/80 text-xs space-y-2">
                          {inc.narration_text && (
                            <div className="p-3 bg-slate-900 border-l-2 border-cyan-500 text-slate-300 rounded-r-xl">
                              <strong className="text-cyan-400">Intelligence Narrative:</strong> {inc.narration_text}
                            </div>
                          )}
                          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider pt-2">Captured Syscall Events ({inc.events?.length || 0})</div>
                          <div className="max-h-48 overflow-y-auto space-y-1">
                            {inc.events?.map((e, idx) => (
                              <div key={idx} className="flex gap-4 text-xs font-mono p-1.5 hover:bg-slate-900 rounded-lg text-slate-300 border border-transparent hover:border-slate-800">
                                <span className="text-slate-500 w-24">{new Date(e.timestamp).toLocaleTimeString()}</span>
                                <span className="text-cyan-400 font-bold w-24">{e.event_type}</span>
                                <span className="text-slate-200 flex-1 truncate">{e.filename || e.comm}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {incidents.length === 0 && (
                    <div className="text-center py-12 text-slate-500 text-xs">
                      No incident timeline records captured yet. Run a simulation or connect local daemon to capture events.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "analytics" && (
            <div className="flex-1 p-6 overflow-y-auto bg-slate-950/60 font-mono">
              <div className="max-w-4xl mx-auto space-y-6">
                <div>
                  <h2 className="text-lg font-black text-slate-100 uppercase tracking-wide">Security Analytics & Metrics</h2>
                  <p className="text-xs text-slate-400">Kernel event breakdown and threat metrics</p>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="glass-card p-4 rounded-2xl border border-slate-800">
                    <p className="text-xs text-slate-400 font-bold">Total Syscalls Captured</p>
                    <p className="text-3xl font-black text-cyan-400 mt-2">{eventLogs.length}</p>
                  </div>
                  <div className="glass-card p-4 rounded-2xl border border-slate-800">
                    <p className="text-xs text-slate-400 font-bold">Compromised PIDs</p>
                    <p className="text-3xl font-black text-red-400 mt-2">{compromisedCount}</p>
                  </div>
                  <div className="glass-card p-4 rounded-2xl border border-slate-800">
                    <p className="text-xs text-slate-400 font-bold">Terminated PIDs</p>
                    <p className="text-3xl font-black text-emerald-400 mt-2">{terminatedCount}</p>
                  </div>
                </div>

                <div className="glass-card p-5 rounded-2xl border border-slate-800 space-y-3">
                  <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Syscall Distribution</h3>
                  <div className="space-y-2 text-xs">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-slate-400">openat (.env & file reads)</span>
                        <span className="text-cyan-400 font-bold">{eventLogs.filter(e => e.event_type === "file_open").length}</span>
                      </div>
                      <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                        <div className="bg-cyan-500 h-full" style={{ width: `${Math.min((eventLogs.filter(e => e.event_type === "file_open").length / (eventLogs.length || 1)) * 100, 100)}%` }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-slate-400">execve (process spawns)</span>
                        <span className="text-amber-400 font-bold">{eventLogs.filter(e => e.event_type === "exec_spawn").length}</span>
                      </div>
                      <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                        <div className="bg-amber-500 h-full" style={{ width: `${Math.min((eventLogs.filter(e => e.event_type === "exec_spawn").length / (eventLogs.length || 1)) * 100, 100)}%` }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-slate-400">connect (network exfiltration)</span>
                        <span className="text-red-400 font-bold">{eventLogs.filter(e => e.event_type === "network" || e.event_type === "net_connect").length}</span>
                      </div>
                      <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                        <div className="bg-red-500 h-full" style={{ width: `${Math.min((eventLogs.filter(e => e.event_type === "network" || e.event_type === "net_connect").length / (eventLogs.length || 1)) * 100, 100)}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "network" && (
            <div className="flex-1 p-6 overflow-y-auto bg-slate-950/60 font-mono">
              <div className="max-w-4xl mx-auto space-y-6">
                <div>
                  <h2 className="text-lg font-black text-slate-100 uppercase tracking-wide">Network Connection Topology</h2>
                  <p className="text-xs text-slate-400">Outbound socket connections and destination IP status</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="glass-card p-5 rounded-2xl border border-slate-800">
                    <h3 className="text-xs font-bold text-slate-300 uppercase mb-3">Active Sockets</h3>
                    <div className="text-3xl font-black text-cyan-400">{networkConnections}</div>
                  </div>
                  <div className="glass-card p-5 rounded-2xl border border-slate-800">
                    <h3 className="text-xs font-bold text-slate-300 uppercase mb-3">Suspicious Endpoints</h3>
                    <div className="text-3xl font-black text-red-400">{threatsDetected}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── Event Stream Sidebar (320px) ─── */}
          <div className="w-80 glass-panel border-l border-slate-800/80 flex flex-col shrink-0">
            {/* Sidebar Header */}
            <div className="px-4 py-3.5 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/40 font-mono">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Live Event Stream</span>
              </div>
              <span className="text-[10px] bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-full text-cyan-400 font-bold font-mono">
                {filteredLogs.length} events
              </span>
            </div>

            {/* Search & Filter */}
            <div className="p-3 border-b border-slate-800/80 space-y-2 bg-slate-950/40">
              <div className="relative font-mono">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search PID, comm, path..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center gap-1 text-[10px] font-mono">
                <Filter className="w-3 h-3 text-slate-500" />
                {["all", "critical", "high", "medium"].map((sev) => (
                  <button
                    key={sev}
                    onClick={() => setFilterSeverity(sev)}
                    className={`px-2 py-0.5 rounded-lg uppercase font-bold transition-colors ${
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

            {/* Event Feed List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 text-xs font-mono">
              {filteredLogs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2">
                  <Terminal className="w-6 h-6 text-slate-700" />
                  <p className="text-center text-xs text-slate-500">Awaiting kernel events...</p>
                </div>
              ) : (
                filteredLogs.map((evt: KernelEvent, idx: number) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border text-xs transition-all glass-card ${
                      evt.severity === "critical"
                        ? "border-red-500/60 bg-red-950/20 text-red-200"
                        : evt.severity === "high"
                        ? "border-orange-500/60 bg-orange-950/20 text-orange-200"
                        : "border-slate-800 bg-slate-900/60 text-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1 font-bold">
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
                      <span className="text-[10px] text-slate-400">PID {evt.pid}</span>
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

      {/* ─── WebSocket Daemon Settings Modal ─── */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel border border-slate-700 rounded-3xl p-6 max-w-md w-full font-mono text-xs space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-100">
                <Settings className="w-4 h-4 text-cyan-400" />
                <span>eBPF Daemon Connection</span>
              </div>
              <button onClick={() => setShowSettingsModal(false)} className="text-slate-400 hover:text-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-slate-400 font-bold block">WebSocket Target Address:</label>
              <input
                type="text"
                value={customWsUrl}
                onChange={(e) => setCustomWsUrl(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
                placeholder="ws://localhost:8765"
              />
              <p className="text-[11px] text-slate-500">
                Default: <code className="text-cyan-400">ws://localhost:8765</code> (local eBPF daemon)
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setWsUrl(customWsUrl);
                  setShowSettingsModal(false);
                }}
                className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black px-4 py-2 rounded-xl text-xs"
              >
                Save & Connect
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── How to Run Locally Help Modal ─── */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel border border-slate-700 rounded-3xl p-6 max-w-lg w-full font-mono text-xs space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-100">
                <HelpCircle className="w-4 h-4 text-cyan-400" />
                <span>How to Run Simulation Locally</span>
              </div>
              <button onClick={() => setShowHelpModal(false)} className="text-slate-400 hover:text-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-slate-300 leading-relaxed font-sans">
              <p className="text-xs">
                Follow these 3 terminal steps to test the real-time attack simulator and eBPF kernel probes locally:
              </p>

              <div className="space-y-2 font-mono text-[11px]">
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <div className="text-cyan-400 font-bold mb-1">Terminal 1: C2 Exfil Listener</div>
                  <code>python simulator/listener.py</code>
                </div>

                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <div className="text-cyan-400 font-bold mb-1">Terminal 2: eBPF Daemon (Root/WS)</div>
                  <code>sudo python3 ebpf/daemon.py</code>
                  <div className="text-[10px] text-slate-500 mt-1">(Use `python ebpf/daemon.py` on Windows for Mock Mode)</div>
                </div>

                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <div className="text-cyan-400 font-bold mb-1">Terminal 3: Trigger Supply Chain Attack</div>
                  <code>cd simulator/target-app && npm install --foreground-scripts</code>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowHelpModal(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-4 py-2 rounded-xl text-xs"
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
