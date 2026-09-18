import assert from "node:assert/strict";
import test from "node:test";

import { AgentLoop } from "@/agent/agent-loop";
import { FakeModel } from "@/model/fake-model";
import { searchLogsTool } from "@/tools/search-logs";
import { serviceStatusTool } from "@/tools/service-status";
import { failingMetricsTool } from "@/tools/failing-metrics";
import { ToolRegistry } from "@/tools/registry";
import { Tracer } from "@/trace/tracer";

test("recovers from a tool failure and continues investigation", async () => {
  const registry = new ToolRegistry();

  registry.register(searchLogsTool);
  registry.register(failingMetricsTool);
  registry.register(serviceStatusTool);

  const tracer = new Tracer();

  const agent = new AgentLoop(
    new FakeModel(),
    registry,
    {
      maxSteps: 5,
    },
    tracer,
  );

  const result = await agent.run(
    "Why did the checkout service have elevated errors around 10:30 UTC?",
  );

  assert.equal(result.status, "completed");

  const failedObservation =
    result.state.observations.find(
      (observation) =>
        observation.toolName === "get_service_metrics",
    );

  assert.ok(failedObservation);
  assert.equal(
    failedObservation.result.success,
    false,
  );
  assert.equal(
    failedObservation.result.error,
    "Metrics backend unavailable.",
  );

  const toolNames =
    result.state.observations.map(
      (observation) => observation.toolName,
    );

  assert.deepEqual(toolNames, [
    "search_logs",
    "get_service_metrics",
    "get_service_status",
  ]);

  const trace = tracer.getTrace();

  assert.ok(
    trace.events.some(
      (event) =>
        event.type === "tool_error" &&
        event.data?.error ===
          "Metrics backend unavailable.",
    ),
  );

  assert.ok(
    trace.events.some(
      (event) =>
        event.type === "tool_result" &&
        event.data?.toolName ===
          "get_service_status",
    ),
  );

  assert.equal(
    result.response?.limitations.includes(
      "Database metrics were unavailable.",
    ),
    true,
  );
});