import { z } from "zod";
import { serviceStatuses } from "@/data/fixtures";
import type { Tool } from "./tool";

const serviceStatusInput = z.object({
  service: z.string(),
});

const serviceStatusOutput = z.object({
  status: z.string(),
  message: z.string(),
});

export const serviceStatusTool: Tool = {
  name: "get_service_status",
  description: "Retrieve the current health status of a service.",
  inputSchema: serviceStatusInput,
  outputSchema: serviceStatusOutput,

  async execute(input) {
    const parsed = serviceStatusInput.safeParse(input);

    if (!parsed.success) {
      return {
        success: false,
        error: "Invalid get_service_status arguments",
      };
    }

    const service = parsed.data.service;

    const status =
      serviceStatuses[service as keyof typeof serviceStatuses];

    if (!status) {
      return {
        success: false,
        error: `Unknown service: ${service}`,
      };
    }

    return {
      success: true,
      data: status,
    };
  },
};