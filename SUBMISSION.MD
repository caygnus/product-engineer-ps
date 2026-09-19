
# Product Engineering Challenge Submission

## Candidate

- **Name:** Shubham Pawar
- **Email:** pawarshubham5959@gmail.com
- **GitHub:** https://github.com/ShubhamPawar-19
- **Selected problem:** Problem 4 — Observable Agent Loop
- **Demo video:** https://youtu.be/wFIj1Qodn3M

## Run the project

### Prerequisites

- Node.js 20+
- npm

No API keys, credentials, or paid model APIs are required for the assessment implementation.

### Setup

```bash
git clone https://github.com/ShubhamPawar-19/product-engineer-ps.git
cd product-engineer-ps
git checkout problem-4-observable-agent
cd incident-investigator
npm install
````

### Run the application

```bash
npm run dev
```

Open `http://localhost:3000`.

The application provides three scenarios directly from the UI.

### Successful scenario

1. Select `Normal`.
2. Keep the default investigation objective:
   `Why did the checkout service have elevated errors around 10:30 UTC?`
3. Click `Run Investigation`.
4. The agent performs a multi-step investigation using:
   `search_logs → get_service_metrics → get_service_status`
5. Review the final conclusion, evidence, limitations, and ordered operational trace.

### Failure / recovery scenario

1. Select `Tool Failure`.
2. Click `Run Investigation`.
3. The metrics tool deliberately returns a failure.
4. The failure is recorded in the trace and retained as an observation.
5. The agent continues by selecting the service-status tool.
6. The final response explicitly reports the unavailable metrics instead of treating them as evidence.

### Execution-limit scenario

1. Select `Execution Limit`.
2. Click `Run Investigation`.
3. The agent is configured with a maximum of 2 steps.
4. After the second step, execution stops with `limit_reached`.
5. No additional model or tool call is made after the limit is reached.

## Run the tests

From the `incident-investigator` directory:

```bash
npm test
```

The test suite currently contains 8 tests covering:

* Tool registration and lookup
* Tool input validation
* Multi-step investigation
* Tool failure and recovery
* Malformed tool results
* Execution-limit enforcement

All 8 tests pass without requiring any external service.

## Architecture and data flow

The implementation separates the model, orchestration, tools, validation, state, tracing, and presentation.

```text
Investigation Objective
        |
        v
    AgentLoop
    /   |    \
   v    v     v
 Model  ToolRegistry  Tracer
   |        |
   v        v
Decision   Tools
           ├── search_logs
           ├── get_service_metrics
           └── get_service_status
                  |
                  v
             Tool Result
                  |
                  v
             Agent State
                  |
                  v
          Next Model Decision
                  |
             Repeat / Finish
```

### AgentLoop

The `AgentLoop` owns the control flow and is responsible for:

* Calling the model
* Validating tool decisions
* Resolving tools
* Validating tool arguments
* Executing tools
* Validating tool results
* Maintaining agent state
* Handling tool failures
* Enforcing the execution limit
* Recording trace events
* Producing the final result

### Model

The `Model` interface produces structured decisions:

* `tool_call` with a tool name and arguments
* `final` with evidence, conclusion, and limitations

The implementation uses a deterministic `FakeModel` so the complete control loop can be demonstrated and tested without a paid external model API.

### ToolRegistry

The registry owns available tools and provides controlled tool lookup. Duplicate registrations and unknown tools are rejected.

### Tools

Each tool defines:

* Name
* Description
* Input schema
* Output schema
* Execution behavior

The prototype includes:

* `search_logs`
* `get_service_metrics`
* `get_service_status`

All tools use synthetic incident data.

### Validation

Zod schemas validate both tool inputs and outputs at runtime. Invalid arguments or malformed tool results become visible tool errors instead of entering trusted agent state.

### Agent State

The state retains:

* Investigation objective
* Tool observations
* Tool arguments
* Tool results and failures
* Current step count

This state is passed back to the model for subsequent decisions.

### Tracer

The tracer records ordered operational events including:

* Agent start
* Model decisions
* Tool calls
* Tool results
* Tool errors
* Agent completion
* Agent termination

The trace intentionally records operational events and concise model-visible summaries rather than hidden chain-of-thought.

## Technology choices

### Next.js + TypeScript

I chose Next.js because it provides a lightweight way to expose both the demonstration UI and API while keeping the project easy to run locally.

TypeScript provides strong compile-time contracts between the agent, model, tools, and state.

I considered a standalone Node.js service, but that would add another application boundary without providing meaningful value for this focused prototype.

### Zod

Zod provides runtime validation for data crossing the model/tool boundary.

TypeScript alone cannot validate runtime data produced by a model or external tool, so explicit schemas were important for this problem.

### Node test runner + tsx

I used Node's built-in test runner with `tsx --test`.

This keeps the project lightweight while still providing deterministic isolated tests without adding a larger testing framework.

### Synthetic data + deterministic model

The challenge does not require a paid model API. I therefore used synthetic incident data and a deterministic fake model.

This makes the demonstration reproducible and allows the control-loop behavior to be tested independently of model-provider availability.

The trade-off is that the fake model does not represent the variability of a production LLM. The purpose of the prototype is instead to demonstrate the execution harness and its safety boundaries around a model.

## Important decisions

### 1. Separate model decisions from execution authority

The model can request a tool, but it does not directly execute anything.

The `AgentLoop` remains responsible for validation, tool lookup, execution, error handling, state updates, and termination.

This creates a clear control boundary around model-generated actions.

### 2. Validate both tool inputs and outputs

Tool arguments are validated before execution and tool results are validated before entering agent state.

This prevents malformed model output or malformed tool responses from silently propagating through the investigation.

### 3. Make termination an explicit control boundary

The loop has a configurable `maxSteps` limit.

The limit is checked before starting another iteration. Once reached, the agent records an explicit stop event and returns without making another model or tool call.

This provides deterministic protection against an indefinitely running agent loop.

## Assumptions and limitations

* Incident data is synthetic and intentionally small.
* The model is deterministic rather than a live LLM.
* Tool execution is local and in-process.
* Trace data is currently stored in memory.
* Run state is not persisted after the process exits.
* Authentication and authorization are outside the scope of this prototype.
* There are no production observability integrations.
* There is no cloud deployment.
* The implementation focuses on a single agent rather than multi-agent orchestration.
* Tools are local implementations rather than real production integrations.
* The log-search time range is represented in the tool interface but the synthetic fixture is intentionally simplified.
* No long-term memory or external knowledge search is included.

These limitations are intentional to keep the implementation focused on the required agent-loop behavior.

## Production and scale

If this prototype needed to operate as a production system, I would first separate agent execution from the HTTP request/UI process and introduce a durable job-based execution model.

A possible architecture would be:

```text
API
 |
 v
Run / Job Queue
 |
 v
Agent Worker
 ├── Model Provider
 ├── Tool Registry
 ├── Execution Policy
 └── Agent State
 |
 v
Persistent Run State + Trace Store
```

I would then add:

* Persistent run state and traces
* Per-run time, step, and token budgets
* Tool-level authorization
* Bounded retries and timeouts
* Idempotency for consequential tools
* Concurrent job controls
* Secret redaction before trace persistence
* Approval gates for consequential actions
* Structured metrics and monitoring
* Remote tool execution with explicit trust boundaries

The core model and tool interfaces could remain largely unchanged. The execution environment around them would become durable and distributed.

For concurrent cloud jobs, each investigation would receive an isolated run ID and durable state. Workers could process jobs independently while enforcing per-run and global concurrency limits.

For consequential tools such as sending an email, modifying data, or triggering an external action, I would add explicit authorization and approval policies rather than allowing the model to invoke them solely based on generated output.

## AI usage

I used ChatGPT as an engineering assistant during development for:

* Architecture and component decomposition
* Agent-loop design discussions
* Identifying edge cases and failure scenarios
* Debugging assistance
* Test-case planning
* Documentation refinement
* Demo and presentation planning

I remained responsible for the implementation, design decisions, testing, and final submission.

The submitted application does not depend on ChatGPT or another paid model API at runtime. The runtime uses a deterministic fake model and synthetic data.

## Credibility note

### NexFlow — AI Workflow Automation SaaS

**Problem it solved**

NexFlow is an AI-powered workflow automation platform designed to let users connect triggers, actions, and AI processing into executable workflows without manually building the underlying integration logic.

The product is aimed at practical business automation use cases such as lead handling, customer communication, notifications, and AI-assisted workflows.

**My personal contribution**

I designed and implemented the core product architecture and the majority of the application myself.

My work included:

* Workflow builder and node-based execution model
* Trigger and action abstractions
* Workflow execution orchestration
* React Flow-based workflow editor
* Next.js application architecture
* TypeScript/Node.js backend logic
* Prisma and PostgreSQL data layer
* Authentication
* Inngest-based background execution
* Real-time execution updates
* AI provider integrations including OpenAI, Anthropic, and Gemini
* Gmail, WhatsApp, Slack, Discord, Stripe, HTTP, and other workflow integrations
* Webhook and Gmail trigger flows
* Execution state and error handling
* Product UI and deployment

**Scale / operational complexity**

NexFlow is a deployed product rather than a standalone demo. Its architecture includes asynchronous workflow execution, external API integrations, authentication, database persistence, AI provider calls, trigger processing, and real-time execution state.

The system was designed around reusable trigger and action nodes so additional integrations could be added without rewriting the execution engine.

**Difficult engineering / product decision**

One important architectural decision was to separate trigger nodes from execution/action nodes and route execution through a common workflow engine.

Instead of implementing each workflow as a special-case sequence, workflows are represented as nodes and relationships and executed through a shared orchestration layer.

This made it possible to add integrations such as Gmail, WhatsApp, Slack, Discord, HTTP, Stripe, and AI providers while keeping the execution model consistent.

Another important decision was using asynchronous execution for workflows rather than tying long-running operations directly to an HTTP request. This allowed external API calls and AI operations to execute independently while the UI could receive execution-state updates.

**Public evidence**

NexFlow is publicly deployed and the source code can be provided through my GitHub profile / project repository.

NexFlow GitHub : https://github.com/ShubhamPawar-19/Nexflow 
Live Link : https://nexflow-swart.vercel.app/login
Demo Video : https://youtu.be/5Rw8B3kuzxc

