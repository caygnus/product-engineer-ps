import type {
  AgentState,
  ModelDecision,
} from "@/agent/types";

import type { Model, ModelInput } from "./model";

export class FakeModel implements Model {
  async decide(input: ModelInput): Promise<ModelDecision> {
    const { state } = input;

    // Step 1: investigate application logs.
    if (state.observations.length === 0) {
      return {
        type: "tool_call",
        toolCall: {
          toolName: "search_logs",
          arguments: {
            service: "checkout",
            query: "database connection timeout",
            timeRange: "10:00-11:00",
          },
        },
      };
    }

    // Step 2: inspect database metrics.
    const searchedLogs = state.observations.some(
      (observation) =>
        observation.toolName === "search_logs",
    );

    if (
      searchedLogs &&
      !state.observations.some(
        (observation) =>
          observation.toolName === "get_service_metrics",
      )
    ) {
      return {
        type: "tool_call",
        toolCall: {
          toolName: "get_service_metrics",
          arguments: {
            service: "database",
          },
        },
      };
    }

    // Step 3: verify database health.
    const checkedMetrics = state.observations.some(
      (observation) =>
        observation.toolName === "get_service_metrics",
    );

    if (
      checkedMetrics &&
      !state.observations.some(
        (observation) =>
          observation.toolName === "get_service_status",
      )
    ) {
      return {
        type: "tool_call",
        toolCall: {
          toolName: "get_service_status",
          arguments: {
            service: "database",
          },
        },
      };
    }

    const metricsFailed = state.observations.some(
  (observation) =>
    observation.toolName === "get_service_metrics" &&
    !observation.result.success,
);

if (
  metricsFailed &&
  !state.observations.some(
    (observation) =>
      observation.toolName === "get_service_status",
  )
) {
  return {
    type: "tool_call",
    toolCall: {
      toolName: "get_service_status",
      arguments: {
        service: "database",
      },
    },
  };
}

    // Final response is constructed from actual tool observations.
    const logObservation = state.observations.find(
      (observation) =>
        observation.toolName === "search_logs",
    );

    const metricsObservation = state.observations.find(
      (observation) =>
        observation.toolName === "get_service_metrics",
    );

    const statusObservation = state.observations.find(
      (observation) =>
        observation.toolName === "get_service_status",
    );

    const evidence: string[] = [];

    const limitations: string[] = [
      "The investigation uses synthetic incident data.",
    ];

    if (
      logObservation?.result.success &&
      typeof logObservation.result.data === "object" &&
      logObservation.result.data !== null
    ) {
      const data = logObservation.result.data as {
        count?: number;
      };

      evidence.push(
        `Checkout logs contained ${data.count ?? 0} matching database timeout errors.`,
      );
    } else {
      limitations.push(
        "Log evidence was unavailable.",
      );
    }

    if (
      metricsObservation?.result.success &&
      typeof metricsObservation.result.data === "object" &&
      metricsObservation.result.data !== null
    ) {
      const data = metricsObservation.result.data as {
        connectionUtilization?: number;
        connectionErrors?: number;
      };

      evidence.push(
        `Database connection utilization reached ${data.connectionUtilization}%, with ${data.connectionErrors} connection errors.`,
      );
    } else {
      limitations.push(
        "Database metrics were unavailable.",
      );
    }

    if (
      statusObservation?.result.success &&
      typeof statusObservation.result.data === "object" &&
      statusObservation.result.data !== null
    ) {
      const data = statusObservation.result.data as {
        status?: string;
        message?: string;
      };

      evidence.push(
        `Database service status was ${data.status}: ${data.message}.`,
      );
    } else {
      limitations.push(
        "Database service status was unavailable.",
      );
    }

    return {
      type: "final",
      response: {
        evidence,
        conclusion:
          "The available evidence indicates that database connection exhaustion contributed to the elevated checkout errors.",
        limitations,
      },
    };
  }
}