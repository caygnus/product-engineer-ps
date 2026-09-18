import type {
  AgentConfig,
  AgentResult,
  AgentState,
  ModelDecision,
} from "./types";

import type { Model } from "@/model/model";
import type { ToolRegistry } from "@/tools/registry";
import { Tracer } from "@/trace/tracer";

export class AgentLoop {
  constructor(
    private readonly model: Model,
    private readonly tools: ToolRegistry,
    private readonly config: AgentConfig,
    private readonly tracer: Tracer,
  ) {}

  async run(objective: string): Promise<AgentResult> {
    const state: AgentState = {
      objective,
      observations: [],
      stepCount: 0,
    };

    this.tracer.record(
      "agent_started",
      "Investigation started.",
      {
        objective,
      },
    );

    while (true) {
      // Check the limit BEFORE making another model/tool call.
      if (state.stepCount >= this.config.maxSteps) {
        const reason =
          `Maximum step limit of ${this.config.maxSteps} reached.`;

        this.tracer.record(
          "agent_stopped",
          reason,
          {
            reason: "limit_reached",
            stepCount: state.stepCount,
          },
        );

        return {
          status: "limit_reached",
          state,
          stopReason: reason,
        };
      }

      state.stepCount += 1;

      let decision: ModelDecision;

      try {
        decision = await this.model.decide({
          objective,
          state,
        });

        this.tracer.record(
          "model_decision",
          `Model selected ${decision.type}.`,
          {
            decisionType: decision.type,
            toolName: decision.toolCall?.toolName,
          },
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Model decision failed.";

        this.tracer.record(
          "model_error",
          message,
        );

        return {
          status: "failed",
          state,
          stopReason: message,
        };
      }

      if (decision.type === "final") {
        this.tracer.record(
          "agent_completed",
          "Investigation completed with a final response.",
        );

        return {
          status: "completed",
          response: decision.response,
          state,
        };
      }

      if (!decision.toolCall) {
        const message =
          "Model returned a tool decision without a tool call.";

        this.tracer.record(
          "agent_stopped",
          message,
          {
            reason: "invalid_model_decision",
          },
        );

        return {
          status: "failed",
          state,
          stopReason: message,
        };
      }

      const {
        toolName,
        arguments: toolArguments,
      } = decision.toolCall;

      this.tracer.record(
        "tool_call",
        `Calling tool: ${toolName}.`,
        {
          toolName,
          arguments: toolArguments,
        },
      );

      let tool;

      try {
        tool = this.tools.get(toolName);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unknown tool.";

        this.tracer.record(
          "tool_error",
          message,
          {
            toolName,
          },
        );

        state.observations.push({
          toolName,
          arguments: toolArguments,
          result: {
            success: false,
            error: message,
          },
        });

        continue;
      }

      // Validate model-produced tool arguments before execution.
      const validation =
        tool.inputSchema.safeParse(toolArguments);

      if (!validation.success) {
        const message =
          "Tool arguments failed validation.";

        this.tracer.record(
          "tool_error",
          message,
          {
            toolName,
          },
        );

        state.observations.push({
          toolName,
          arguments: toolArguments,
          result: {
            success: false,
            error: message,
          },
        });

        continue;
      }

      try {
        const result =
          await tool.execute(validation.data);

        if (!result.success) {
          this.tracer.record(
            "tool_error",
            `Tool ${toolName} failed.`,
            {
              toolName,
              error: result.error,
            },
          );

          state.observations.push({
            toolName,
            arguments: toolArguments,
            result,
          });

          continue;
        }

        // Validate successful tool output before giving it back to the model.
        const outputValidation =
          tool.outputSchema.safeParse(result.data);

        if (!outputValidation.success) {
          const message =
            `Tool ${toolName} returned an invalid result.`;

          this.tracer.record(
            "tool_error",
            message,
            {
              toolName,
            },
          );

          state.observations.push({
            toolName,
            arguments: toolArguments,
            result: {
              success: false,
              error: message,
            },
          });

          continue;
        }

        this.tracer.record(
          "tool_result",
          `Tool ${toolName} returned successfully.`,
          {
            toolName,
            result: outputValidation.data,
          },
        );

        state.observations.push({
          toolName,
          arguments: toolArguments,
          result: {
            success: true,
            data: outputValidation.data,
          },
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Tool execution failed.";

        this.tracer.record(
          "tool_error",
          message,
          {
            toolName,
          },
        );

        state.observations.push({
          toolName,
          arguments: toolArguments,
          result: {
            success: false,
            error: message,
          },
        });
      }
    }
  }
}