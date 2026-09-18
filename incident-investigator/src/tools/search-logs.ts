import { z } from "zod";
import { logs } from "@/data/fixtures";
import type { Tool } from "./tool";

const searchLogsInput = z.object({
  service: z.string(),
  query: z.string(),
  timeRange: z.string(),
});

const searchLogsOutput = z.object({
  matches: z.array(
    z.object({
      timestamp: z.string(),
      service: z.string(),
      level: z.string(),
      message: z.string(),
    }),
  ),
  count: z.number(),
});

export const searchLogsTool: Tool = {
  name: "search_logs",
  description:
    "Search service logs for errors or events within a requested time range.",
  inputSchema: searchLogsInput,
  outputSchema: searchLogsOutput,

  async execute(input) {
    const parsed = searchLogsInput.safeParse(input);

    if (!parsed.success) {
      return {
        success: false,
        error: "Invalid search_logs arguments",
      };
    }

    const { service, query } = parsed.data;

    const matches = logs.filter(
      (log) =>
        log.service === service &&
        log.message.toLowerCase().includes(query.toLowerCase()),
    );

    return {
      success: true,
      data: {
        matches,
        count: matches.length,
      },
    };
  },
};