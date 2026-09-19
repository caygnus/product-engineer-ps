import { z } from "zod";
import { metrics } from "@/data/fixtures";
import type { Tool } from "./tool";

const serviceMetricsInput = z.object({
  service: z.string(),
});

const serviceMetricsOutput = z.union([
  z.object({
    errorRate: z.number(),
    requestRate: z.number(),
    latencyP95: z.number(),
  }),
  z.object({
    connectionUtilization: z.number(),
    connectionErrors: z.number(),
  }),
]);

export const serviceMetricsTool: Tool = {
  name: "get_service_metrics",
  description:
    "Retrieve error rate, request rate, latency, and database connection metrics.",
  inputSchema: serviceMetricsInput,
  outputSchema: serviceMetricsOutput,

  async execute(input) {
    const parsed = serviceMetricsInput.safeParse(input);

    if (!parsed.success) {
      return {
        success: false,
        error: "Invalid get_service_metrics arguments",
      };
    }

    const service = parsed.data.service;

    if (service === "checkout") {
      return {
        success: true,
        data: metrics.checkout,
      };
    }

    if (service === "database") {
      return {
        success: true,
        data: metrics.database,
      };
    }

    return {
      success: false,
      error: `No metrics available for service: ${service}`,
    };
  },
};