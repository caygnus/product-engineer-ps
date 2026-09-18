export type TraceEventType =
  | "agent_started"
  | "model_decision"
  | "model_error"
  | "tool_call"
  | "tool_result"
  | "tool_error"
  | "agent_completed"
  | "agent_stopped";

export interface TraceEvent {
  id: number;
  timestamp: string;
  type: TraceEventType;
  message: string;
  data?: Record<string, unknown>;
}

export interface Trace {
  events: TraceEvent[];
}