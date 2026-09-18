import assert from "node:assert/strict";
import test from "node:test";

import { AgentLoop } from "@/agent/agent-loop";
import type { Model, ModelInput } from "@/model/model";
import type { ModelDecision } from "@/agent/types";
import type { Tool } from "@/tools/tool";
import { ToolRegistry } from "@/tools/registry";
import { Tracer } from "@/trace/tracer";
import { z } from "zod";

const malformedTool: Tool = {
  name: "malformed_tool",
  description: "Returns an intentionally invalid result.",
  inputSchema: z.object({
    service: z.string(),
  }),
  outputSchema: z.object({
    status: z.string(),
  }),

  async execute() {
    return {
      success: true,
      data: {
        status: 123,
      },
    };
  },
};

class MalformedResultModel implements Model {
  private calls = 0;

  async decide(
    _input: ModelInput,
  ): Promise<ModelDecision> {
    this.calls += 1;

    if (this.calls === 1) {
      return {
        type: "tool_call",
        toolCall: {
          toolName: "malformed_tool",
          arguments: {
            service: "checkout",
          },
        },
      };
    }

    return {
      type: "final",
      response: {
        evidence: [],
        conclusion:
          "The malformed tool result was rejected before it could be used as evidence.",
        limitations: [
          "The malformed tool result was unavailable.",
        ],
      },
    };
  }
}

test("rejects malformed tool output and continues safely", async () => {
  const registry = new ToolRegistry();

  registry.register(malformedTool);

  const tracer = new Tracer();

  const agent = new AgentLoop(
    new MalformedResultModel(),
    registry,
    {
      maxSteps: 3,
    },
    tracer,
  );

  const result = await agent.run(
    "Investigate checkout service health.",
  );

  assert.equal(result.status, "completed");

  assert.equal(
    result.state.observations.length,
    1,
  );

  assert.equal(
    result.state.observations[0]?.result.success,
    false,
  );

  assert.equal(
    result.state.observations[0]?.result.error,
    "Tool malformed_tool returned an invalid result.",
  );

  const trace = tracer.getTrace();

  assert.ok(
    trace.events.some(
      (event) =>
        event.type === "tool_error" &&
        event.message ===
          "Tool malformed_tool returned an invalid result.",
    ),
  );

  assert.equal(
    trace.events.at(-1)?.type,
    "agent_completed",
  );
});