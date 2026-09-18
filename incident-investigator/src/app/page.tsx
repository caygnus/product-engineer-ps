"use client";

import { FormEvent, useState } from "react";

type Scenario = "normal" | "failure" | "limit";

type TraceEvent = {
  id: number;
  timestamp: string;
  type: string;
  message: string;
  data?: Record<string, unknown>;
};

type InvestigationResponse = {
  status: string;
  response?: {
    evidence: string[];
    conclusion: string;
    limitations: string[];
  };
  stopReason?: string;
};

type ApiResponse = {
  result: InvestigationResponse;
  trace: {
    events: TraceEvent[];
  };
  scenario: Scenario;
};

const DEFAULT_OBJECTIVE =
  "Why did the checkout service have elevated errors around 10:30 UTC?";

const SCENARIOS: {
  id: Scenario;
  label: string;
  description: string;
}[] = [
  {
    id: "normal",
    label: "Normal",
    description: "Multi-step investigation across 3 tools",
  },
  {
    id: "failure",
    label: "Tool Failure",
    description: "Metrics backend fails, agent recovers",
  },
  {
    id: "limit",
    label: "Execution Limit",
    description: "Agent stops at the configured step limit",
  },
];

export default function Home() {
  const [objective, setObjective] =
    useState(DEFAULT_OBJECTIVE);

  const [scenario, setScenario] =
    useState<Scenario>("normal");

  const [result, setResult] =
    useState<InvestigationResponse | null>(null);

  const [trace, setTrace] =
    useState<TraceEvent[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  async function runInvestigation(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setLoading(true);
    setError(null);
    setResult(null);
    setTrace([]);

    try {
      const response = await fetch(
        "/api/investigate",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            objective,
            scenario,
          }),
        },
      );

      const data =
        (await response.json()) as
          | ApiResponse
          | { error?: string };

      if (!response.ok) {
        throw new Error(
          "error" in data
            ? data.error ?? "Investigation failed."
            : "Investigation failed.",
        );
      }

      const successData = data as ApiResponse;

      setResult(successData.result);
      setTrace(successData.trace.events);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Investigation failed.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-zinc-100">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10">
          <p className="mb-2 text-sm font-medium text-zinc-400">
            Caygnus Technical Assessment
          </p>

          <h1 className="text-4xl font-semibold tracking-tight">
            Incident Investigator
          </h1>

          <p className="mt-3 max-w-2xl text-zinc-400">
            An observable agent loop that investigates
            incidents using structured tools, bounded
            execution, failure handling, and evidence-backed
            conclusions.
          </p>
        </header>

        <form
          onSubmit={runInvestigation}
          className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
        >
          <label
            htmlFor="objective"
            className="mb-3 block text-sm font-medium"
          >
            Investigation objective
          </label>

          <textarea
            id="objective"
            value={objective}
            onChange={(event) =>
              setObjective(event.target.value)
            }
            rows={3}
            className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-950 p-4 text-sm outline-none transition focus:border-zinc-500"
          />

          <div className="mt-6">
            <p className="mb-3 text-sm font-medium">
              Demo scenario
            </p>

            <div className="grid gap-3 md:grid-cols-3">
              {SCENARIOS.map((item) => {
                const selected =
                  scenario === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      setScenario(item.id)
                    }
                    className={`rounded-xl border p-4 text-left transition ${
                      selected
                        ? "border-zinc-400 bg-zinc-800"
                        : "border-zinc-800 bg-zinc-950 hover:border-zinc-700"
                    }`}
                  >
                    <div className="text-sm font-medium">
                      {item.label}
                    </div>

                    <div className="mt-1 text-xs leading-5 text-zinc-500">
                      {item.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6 flex items-center gap-4">
            <button
              type="submit"
              disabled={
                loading || !objective.trim()
              }
              className="rounded-xl bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? "Investigating..."
                : "Run Investigation"}
            </button>

            <span className="text-xs text-zinc-500">
              {scenario === "limit"
                ? "Maximum 2 agent steps"
                : "Maximum 5 agent steps"}
            </span>
          </div>
        </form>

        {error && (
          <div className="mb-8 rounded-xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {result && (
          <section className="mb-8 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  Investigation Result
                </h2>

                <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300">
                  {result.status}
                </span>
              </div>

              {result.response ? (
                <>
                  <div className="mb-6">
                    <h3 className="mb-2 text-sm font-medium text-zinc-400">
                      Conclusion
                    </h3>

                    <p className="leading-7 text-zinc-200">
                      {result.response.conclusion}
                    </p>
                  </div>

                  <div className="mb-6">
                    <h3 className="mb-3 text-sm font-medium text-zinc-400">
                      Evidence
                    </h3>

                    <ul className="space-y-3">
                      {result.response.evidence.map(
                        (item, index) => (
                          <li
                            key={index}
                            className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-300"
                          >
                            {item}
                          </li>
                        ),
                      )}
                    </ul>
                  </div>

                  <div>
                    <h3 className="mb-3 text-sm font-medium text-zinc-400">
                      Limitations
                    </h3>

                    <ul className="space-y-2 text-sm text-zinc-500">
                      {result.response.limitations.map(
                        (item, index) => (
                          <li key={index}>
                            • {item}
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                </>
              ) : (
                <div>
                  <h3 className="mb-2 text-sm font-medium text-zinc-400">
                    Stop reason
                  </h3>

                  <p className="text-sm leading-6 text-zinc-300">
                    {result.stopReason ??
                      "Investigation stopped without a final response."}
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <div className="mb-6">
                <h2 className="text-lg font-semibold">
                  Operational Trace
                </h2>

                <p className="mt-1 text-xs text-zinc-500">
                  Model decisions, tool calls, results,
                  errors, and termination events.
                </p>
              </div>

              <div className="space-y-3">
                {trace.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-xl border border-zinc-800 bg-zinc-950 p-4"
                  >
                    <div className="mb-1 flex items-center gap-3">
                      <span className="text-xs font-mono text-zinc-600">
                        #{event.id}
                      </span>

                      <span className="text-xs font-medium text-zinc-300">
                        {event.type}
                      </span>
                    </div>

                    <p className="text-sm text-zinc-400">
                      {event.message}
                    </p>

                    {event.data && (
                      <pre className="mt-3 overflow-x-auto rounded-lg bg-zinc-900 p-3 text-xs leading-5 text-zinc-500">
                        {JSON.stringify(
                          event.data,
                          null,
                          2,
                        )}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {!result && !loading && !error && (
          <div className="rounded-2xl border border-dashed border-zinc-800 p-12 text-center">
            <p className="text-sm text-zinc-500">
              Run an investigation to see the evidence and
              operational trace.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}