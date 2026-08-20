import type { Node, Edge } from "@xyflow/react";

export interface KernelEvent {
  timestamp: string;
  pid: number;
  ppid: number;
  uid: number;
  comm: string;
  event_type: "file_open" | "exec_spawn" | "net_connect" | "network";
  filename: string;
  severity: "critical" | "high" | "medium" | "low";
  attack_type?: string;
  dest_ip?: string;
  dest_port?: number;
  threat?: boolean;
}

export interface NetworkNodeData extends Record<string, unknown> {
  pid: number;
  comm: string;
  dest_ip: string;
  dest_port: number;
  threat: boolean;
}

export type NetworkNode = Node<NetworkNodeData, "networkNode">;

export interface ProcessNodeData extends Record<string, unknown> {
  pid: number;
  ppid: number;
  comm: string;
  severity: "critical" | "high" | "medium" | "low";
  attack_type?: string;
  events: KernelEvent[];
  hasDotEnvAccess: boolean;
  isKilled: boolean;
  onKill: (pid: number) => void;
}

export type ProcessNode = Node<ProcessNodeData, "processNode">;

export interface EventEdgeData extends Record<string, unknown> {
  eventType: string;
  filename: string;
  timestamp: string;
}

export type EventEdge = Edge<EventEdgeData>;

export interface NarrationMessage {
  type: "narration";
  pid: number;
  text: string;
  timestamp: string;
  attack_type: string;
}

export interface RiskScoreData {
  score: number;
  file_opens: number;
  processes_spawned: number;
  network_connections: number;
  anomalies: string[];
}

export interface RiskScoreMessage {
  type: "risk_score";
  data: RiskScoreData;
}

export interface IncidentData {
  id: number;
  start_time: string;
  end_time: string;
  pid: number;
  attack_type: string;
  risk_score: number;
  status: string;
  narration_text?: string;
  events?: KernelEvent[];
}

export type WSMessage =
  | { type: "event"; data: KernelEvent }
  | { type: "kill_result"; pid: number; success: boolean; message: string }
  | NarrationMessage
  | RiskScoreMessage
  | { type: "history"; incidents: IncidentData[] };
