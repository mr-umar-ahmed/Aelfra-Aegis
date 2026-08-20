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

export type WSMessage =
  | { type: "event"; data: KernelEvent }
  | { type: "kill_result"; pid: number; success: boolean; message: string }
  | NarrationMessage;
