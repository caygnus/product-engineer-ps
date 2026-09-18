import { NextResponse } from "next/server";

import { AgentLoop } from "@/agent/agent-loop";
import { FakeModel } from "@/model/fake-model";
import { searchLogsTool } from "@/tools/search-logs";
import { serviceMetricsTool } from "@/tools/service-metrics";
import { serviceStatusTool } from "@/tools/service-status";
import { failingMetricsTool } from "@/tools/failing-metrics";
import { ToolRegistry } from "@/tools/registry";
import { Tracer } from "@/trace/tracer";

type Scenario =
  | "normal"
  | "failure"
  | "limit";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const objective =
      typeof body.objective === "string"
        ? body.objective.trim()
        : "";

    const scenario: Scenario =
      body.scenario === "failure"
        ? "failure"
        : body.scenario === "limit"
          ? "limit"
          : "normal";

    if (!objective) {
      return NextResponse.json(
        {
          error: "Investigation objective is required.",
        },
        {
          status: 400,
        },
      );
    }

    const registry = new ToolRegistry();

    registry.register(searchLogsTool);

    if (scenario === "failure") {
      registry.register(failingMetricsTool);
    } else {
      registry.register(serviceMetricsTool);
    }

    registry.register(serviceStatusTool);

    const tracer = new Tracer();

    const agent = new AgentLoop(
      new FakeModel(),
      registry,
      {
        maxSteps: scenario === "limit" ? 2 : 5,
      },
      tracer,
    );

    const result = await agent.run(objective);

    return NextResponse.json({
      result,
      trace: tracer.getTrace(),
      scenario,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Investigation failed.";

    return NextResponse.json(
      {
        error: message,
      },
      {
        status: 500,
      },
    );
  }
}