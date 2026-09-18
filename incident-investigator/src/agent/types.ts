export type AgentStatus =
  | "completed"
  | "limit_reached"
  | "failed";

export interface ToolCall {
  toolName: string;
  arguments: Record<string, unknown>;
}

export interface ModelDecision {
  type: "tool_call" | "final";
  toolCall?: ToolCall;
  response?: {
    evidence: string[];
    conclusion: string;
    limitations: string[];
  };
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface AgentState {
  objective: string;
  observations: Array<{
    toolName: string;
    arguments: Record<string, unknown>;
    result: ToolResult;
  }>;
  stepCount: number;
}

export interface AgentConfig {
  maxSteps: number;
}

export interface AgentResult {
  status: AgentStatus;
  response?: ModelDecision["response"];
  state: AgentState;
  stopReason?: string;
}