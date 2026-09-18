import assert from "node:assert/strict";
import test from "node:test";

import { AgentLoop } from "@/agent/agent-loop";
import type { Model, ModelInput } from "@/model/model";
import type { ModelDecision } from "@/agent/types";
import { searchLogsTool } from "@/tools/search-logs";
import { ToolRegistry } from "@/tools/registry";
import { Tracer } from "@/trace/tracer";

class LoopingModel implements Model {
  public calls = 0;

  async decide(
    _input: ModelInput,
  ): Promise<ModelDecision> {
    this.calls += 1;

    return {
      type: "tool_call",
      toolCall: {
        toolName: "search_logs",
        arguments: {
          service: "checkout",
          query: "database connection timeout",
          timeRange: "10:00-11:00",
        },
      },
    };
  }
}

test("stops at execution limit without another model call", async () => {
  const registry = new ToolRegistry();
  registry.register(searchLogsTool);

  const tracer = new Tracer();
  const model = new LoopingModel();

  const agent = new AgentLoop(
    model,
    registry,
    {
      maxSteps: 2,
    },
    tracer,
  );

  const result = await agent.run(
    "Investigate checkout errors.",
  );

  assert.equal(
    result.status,
    "limit_reached",
  );

  assert.equal(
    result.state.stepCount,
    2,
  );

  // Exactly two model decisions were allowed.
  assert.equal(model.calls, 2);

  // Exactly two tool executions happened.
  assert.equal(
    result.state.observations.length,
    2,
  );

  assert.equal(
    result.stopReason,
    "Maximum step limit of 2 reached.",
  );

  const trace = tracer.getTrace();

  assert.equal(
    trace.events.at(-1)?.type,
    "agent_stopped",
  );

  assert.equal(
    trace.events.at(-1)?.data?.reason,
    "limit_reached",
  );
});