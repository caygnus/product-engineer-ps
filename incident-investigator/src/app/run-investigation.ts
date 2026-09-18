import { AgentLoop } from "@/agent/agent-loop";
import { FakeModel } from "@/model/fake-model";
import { searchLogsTool } from "@/tools/search-logs";
import { serviceMetricsTool } from "@/tools/service-metrics";
import { serviceStatusTool } from "@/tools/service-status";
import { ToolRegistry } from "@/tools/registry";
import { Tracer } from "@/trace/tracer";

async function main() {
  const registry = new ToolRegistry();

  registry.register(searchLogsTool);
  registry.register(serviceMetricsTool);
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

  const objective =
    "Why did the checkout service have elevated errors around 10:30 UTC?";

  const result = await agent.run(objective);

  console.log("\n=== INVESTIGATION RESULT ===\n");
  console.log(JSON.stringify(result, null, 2));

  console.log("\n=== OPERATIONAL TRACE ===\n");
  console.log(
    JSON.stringify(tracer.getTrace(), null, 2),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});