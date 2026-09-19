import { z } from "zod";
import type { Tool } from "./tool";

const failingMetricsInput = z.object({
  service: z.string(),
});

const failingMetricsOutput = z.object({
  error: z.string(),
});

export const failingMetricsTool: Tool = {
  name: "get_service_metrics",
  description:
    "Simulates a metrics backend outage for failure-handling scenarios.",
  inputSchema: failingMetricsInput,
  outputSchema: failingMetricsOutput,

  async execute() {
    return {
      success: false,
      error: "Metrics backend unavailable.",
    };
  },
};