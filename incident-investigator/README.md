# Incident Investigator

A small, observable agent loop for investigating software incidents through structured tools, bounded execution, failure handling, and evidence-backed conclusions.

Built for the Caygnus Product Engineer technical assessment — Problem 4: **Observable Agent Loop**.

## What it demonstrates

The system implements a real control loop:

Investigation Objective
        ↓
      Model
        ↓
   Tool Selection
        ↓
 Argument Validation
        ↓
    Tool Execution
        ↓
 Result Validation
        ↓
 Observation added to state
        ↓
      Model
        ↓
   Another tool / Final response

The orchestration layer is separate from the model and tools. The model decides what to do next; the agent loop controls whether and how that decision is executed.

## Features

* Structured tool registration and lookup
* Zod validation for tool inputs
* Zod validation for tool outputs
* Multi-step investigations across multiple evidence sources
* Explicit retained agent state
* Ordered operational trace
* Tool failure handling and recovery
* Malformed tool-result handling
* Configurable execution limit
* Deterministic fake model for local execution and tests
* Synthetic incident data
* Final responses that separate evidence, conclusions, and limitations
* No paid model API or external service required

## Running locally

Requirements:

* Node.js 20+
* npm

Install dependencies:

```bash
npm install
```

Start the web interface:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

Run the CLI investigation:

```bash
npm run investigate
```

Run the tool failure scenario:

```bash
npm run failure
```

Run the test suite:

```bash
npm test
```

Type-check:

```bash
npx tsc --noEmit
```

## Demo scenarios

### 1. Normal investigation

Objective:

> Why did the checkout service have elevated errors around 10:30 UTC?

The deterministic model selects:

1. `search_logs`
2. `get_service_metrics`
3. `get_service_status`
4. final response

The final response is grounded in the observations returned by those tools.

### 2. Tool failure

The metrics tool is replaced with a deterministic failing implementation.

The loop observes:

```text
search_logs → success
get_service_metrics → error
get_service_status → success
final response
```

The failure is recorded in the trace and preserved in agent state. The model can continue investigating with another available source.

The final response explicitly reports that database metrics were unavailable rather than treating missing data as evidence.

### 3. Execution limit

The limit scenario configures:

```text
maxSteps = 2
```

After two model/tool steps, the loop checks the limit before making another model call.

The trace ends with:

```text
agent_stopped
reason: limit_reached
```

This prevents unbounded model/tool execution.

## Architecture

```text
                    ┌──────────────────┐
                    │    Web / CLI      │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │   AgentLoop      │
                    │                  │
                    │  • state         │
                    │  • limits        │
                    │  • orchestration │
                    └───────┬──────────┘
                            │
               ┌────────────┴────────────┐
               ▼                         ▼
       ┌──────────────┐          ┌──────────────┐
       │    Model     │          │ ToolRegistry │
       │              │          │              │
       │  FakeModel   │          │ logs         │
       │              │          │ metrics      │
       └──────────────┘          │ status       │
                                 └──────┬───────┘
                                        │
                                        ▼
                                 Synthetic Data

                    ┌──────────────────┐
                    │     Tracer       │
                    │                  │
                    │ ordered events   │
                    └──────────────────┘
```

### Main boundaries

#### `AgentLoop`

Owns execution policy:

* creates and retains agent state
* checks execution limits
* asks the model for the next decision
* resolves tools through the registry
* validates tool arguments
* executes tools
* validates tool results
* records failures
* determines termination

#### `Model`

The model is represented by a small interface:

```ts
interface Model {
  decide(input: ModelInput): Promise<ModelDecision>;
}
```

The loop does not depend on a specific model provider.

`FakeModel` is intentionally deterministic so the assignment can run without a paid API and tests can assert exact behavior.

A production implementation could provide another `Model` adapter without changing the orchestration layer.

#### `Tool`

Each tool declares:

* name
* description
* input schema
* output schema
* execution function

This keeps tool contracts explicit and independently testable.

#### `ToolRegistry`

Owns tool registration and lookup.

It rejects duplicate registrations and unknown tools rather than silently accepting invalid configuration.

#### `Tracer`

Records operational events in execution order.

The trace contains events such as:

```text
agent_started
model_decision
tool_call
tool_result
tool_error
agent_stopped
agent_completed
```

The trace intentionally records operational events rather than hidden model reasoning.

## State

The loop retains explicit state for each investigation:

```ts
```
