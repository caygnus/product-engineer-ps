import { AgentLoop } from "@/agent/agent-loop";
import { FakeModel } from "@/model/fake-model";
import { searchLogsTool } from "@/tools/search-logs";
import { serviceStatusTool } from "@/tools/service-status";
import { failingMetricsTool } from "@/tools/failing-metrics";
import { ToolRegistry } from "@/tools/registry";
import { Tracer } from "@/trace/tracer";

async function main() {
  const registry = new ToolRegistry();

  registry.register(searchLogsTool);
  registry.register(failingMetricsTool);
  registry.register(serviceStatusTool);

  const tracer = new Tracer();
  const model = new FakeModel();

  const agent = new AgentLoop(
    model,
    registry,
    {
      maxSteps: 5,
    },
    tracer,
  );

  const result = await agent.run(
    "Why did the checkout service have elevated errors around 10:30 UTC?",
  );

  console.log("\n=== FAILURE SCENARIO ===\n");
  console.log(JSON.stringify(result, null, 2));

  console.log("\n=== OPERATIONAL TRACE ===\n");
  console.log(JSON.stringify(tracer.getTrace(), null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});