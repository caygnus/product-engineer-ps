import type { AgentState, ModelDecision } from "@/agent/types";

export interface ModelInput {
  objective: string;
  state: AgentState;
}

export interface Model {
  decide(input: ModelInput): Promise<ModelDecision>;
}