import { z } from "zod";
import type { ToolResult } from "@/agent/types";

export interface Tool {
  name: string;
  description: string;
  inputSchema: z.ZodType;
  outputSchema: z.ZodType;
  execute(input: unknown): Promise<ToolResult>;
}