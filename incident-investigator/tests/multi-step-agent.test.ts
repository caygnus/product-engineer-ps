import assert from "node:assert/strict";
import test from "node:test";

import { AgentLoop } from "@/agent/agent-loop";
import type { ModelDecision } from "@/agent/types";
import type { Model } from "@/model/model";
import { searchLogsTool } from "@/tools/search-logs";
import { serviceMetricsTool } from "@/tools/service-metrics";
import { serviceStatusTool } from "@/tools/service-status";
import { ToolRegistry } from "@/tools/registry";
import { Tracer } from "@/trace/tracer";

class DeterministicMultiStepModel implements Model {
  private decisions = 0;

  async decide(): Promise<ModelDecision> {
    this.decisions += 1;

    if (this.decisions === 1) {
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

    if (this.decisions === 2) {
      return {
        type: "tool_call",
        toolCall: {
          toolName: "get_service_metrics",
          arguments: {
            service: "database",
          },
        },
      };
    }

    if (this.decisions === 3) {
      return {
        type: "tool_call",
        toolCall: {
          toolName: "get_service_status",
          arguments: {
            service: "database",
          },
        },
      };
    }

    return {
      type: "final",
      response: {
        evidence: [
          "Logs show repeated database connection timeouts.",
          "Database metrics show high connection utilization.",
          "Database status is degraded.",
        ],
        conclusion:
          "The evidence indicates a database connection issue contributed to the checkout errors.",
        limitations: [],
      },
    };
  }
}

test("runs a multi-step investigation across multiple tools", async () => {
  const registry = new ToolRegistry();

  registry.register(searchLogsTool);
  registry.register(serviceMetricsTool);
  registry.register(serviceStatusTool);

  const tracer = new Tracer();

  const agent = new AgentLoop(
    new DeterministicMultiStepModel(),
    registry,
    {
      maxSteps: 5,
    },
    tracer,
  );

  const result = await agent.run(
    "Investigate elevated checkout errors.",
  );

  assert.equal(result.status, "completed");
  assert.equal(result.state.stepCount, 4);

  assert.deepEqual(
    result.state.observations.map(
      (observation) => observation.toolName,
    ),
    [
      "search_logs",
      "get_service_metrics",
      "get_service_status",
    ],
  );

  assert.equal(
    result.state.observations.every(
      (observation) => observation.result.success,
    ),
    true,
  );

  assert.equal(
    result.response?.evidence.length,
    3,
  );

  const trace = tracer.getTrace();

  assert.ok(
    trace.events.some(
      (event) => event.type === "tool_call",
    ),
  );

  assert.ok(
    trace.events.some(
      (event) => event.type === "tool_result",
    ),
  );

  assert.equal(
    trace.events.at(-1)?.type,
    "agent_completed",
  );
});