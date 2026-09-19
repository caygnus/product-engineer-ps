# Durable Reminders and Follow-ups — Node.js

A small Node.js 20 service for scheduling reminders and follow-ups in a way that survives failures and restarts.

The project uses a JSON file as its durable storage, an injected clock for predictable testing, and a local fake notification destination. There are no external dependencies, which makes the project easy to run and test locally.

## Getting Started

Make sure you have Node.js 20 or later installed.

From the project directory, run:

```powershell
node --test
```

To run the benchmark:

```powershell
node benchmark.js
```

If npm is available, you can also use:

```bash
npm test
npm run benchmark
```

The project does not require any external packages.

## What the Benchmark Tests

The benchmark is designed to simulate real-world situations instead of only testing the happy path.

It:

* Creates reminders in both `Asia/Kolkata` and `America/New_York`
* Updates and cancels scheduled reminders
* Simulates temporary and permanent delivery failures
* Restarts the service before all reminders have been processed
* Re-executes an occurrence to verify idempotency
* Advances the fake clock
* Shows the final delivery/failure counts
* Verifies that duplicate processing does not create duplicate logical notifications

## Design Decisions

### 1. Time Zones

A reminder can be scheduled in two ways:

* Using a UTC `scheduledAt` timestamp
* Using a local `localTime` in the format `YYYY-MM-DDTHH:mm` together with an IANA time zone

For example:

```text
localTime: 2026-09-20T10:30
timeZone: Asia/Kolkata
```

Local times are converted using JavaScript's `Intl` APIs.

DST edge cases are handled deterministically:

* If a local time occurs twice during the fall-back transition, the earlier instant is selected.
* If a local time does not exist during the spring-forward transition, it is moved to the next valid local minute.

The original time zone and requested local time are also stored so the original scheduling information is not lost.

### 2. Finding and Claiming Reminders

The service does not depend on an in-memory timer to decide when a reminder should run.

Instead, the worker periodically checks the durable store for items where:

```text
state = scheduled
nextRunAt <= current time
```

When a reminder is found, it is atomically moved from:

```text
scheduled → running
```

An attempt is also added to its history.

This means the JSON file remains the source of truth even if the process is restarted.

If the application is restarted while something is in the `running` state, the service treats that attempt as interrupted. It records the attempt as `abandoned` and makes the reminder available for processing again.

### 3. Retry Handling

Not every error should be retried.

The destination reports whether an error is `retryable`.

For retryable failures, the service uses exponential backoff:

```text
Attempt 1 → wait 1 second
Attempt 2 → wait 2 seconds
Attempt 3 → final attempt
```

There are a maximum of three total attempts.

Permanent errors, or retryable errors that continue after the maximum number of attempts, move the reminder into:

```text
failed
```

This makes failures visible instead of silently dropping them.

### 4. Idempotency and Duplicate Delivery

A key part of the design is making delivery safe when the process crashes at the wrong moment.

Every new scheduled version gets its own random `deliveryKey`.

That key is passed to the notification destination as an idempotency key.

Consider this situation:

```text
1. Reminder starts processing
2. Notification destination accepts it
3. Application crashes
4. Application restarts
5. Reminder is processed again
```

Without idempotency, the user could receive the same notification twice.

With the `deliveryKey`, the destination recognizes the second request as a duplicate and returns a duplicate acknowledgement instead of creating another logical notification.

This protects the system across the difficult:

```text
delivery succeeded → process crashed → delivery retried
```

boundary.

### 5. Editing and Cancelling Reminders

A reminder can be edited or cancelled while it is still:

```text
scheduled
```

Once the worker claims it and changes its state to:

```text
running
```

the execution boundary has been crossed.

At that point, an edit or cancellation returns a conflict rather than pretending that an already-started delivery can be withdrawn.

Before a reminder is claimed:

* Editing creates a new scheduled version and delivery key.
* The previous schedule is replaced.
* Cancelling prevents future processing.

This keeps the behaviour predictable and avoids race conditions between users changing a reminder and workers processing it.

### 6. Multiple Workers

The current implementation intentionally uses a JSON file and is designed for a single process.

Atomic file replacement protects individual writes, but this is not intended to be a production-grade multi-worker database.

If multiple workers need to process reminders concurrently, the durable store should be replaced with a transactional database that supports mechanisms such as:

* Compare-and-swap
* Atomic state updates
* Lease-based claims
* Transactional writes

The destination-level idempotency mechanism should still be kept because it protects against duplicate logical delivery even when a crash happens between delivery and recording the result.

## State Transitions

The main lifecycle of a reminder looks like this:

```text
scheduled → running → delivered
```

If a temporary failure occurs:

```text
scheduled → running → scheduled
```

The reminder becomes eligible for another attempt.

If delivery permanently fails or all retries are exhausted:

```text
scheduled → running → failed
```

A reminder can also be cancelled before it is claimed:

```text
scheduled → cancelled
```

### Restart Recovery

If the process stops while a reminder is being processed:

```text
running → scheduled
```

The interrupted attempt is not deleted. It remains in the attempt history as:

```text
abandoned
```

This gives us an ordered record of what happened and allows the reminder to be safely processed again.

## Summary

The main goal of this project is to demonstrate a durable reminder workflow that behaves predictably even when things go wrong.

The important ideas are:

* Durable scheduling instead of relying on in-memory timers
* Explicit state transitions
* Retryable vs. permanent failures
* Exponential backoff
* Crash/restart recovery
* Idempotent notification delivery
* Deterministic handling of time zones and DST
* Clear behaviour when edits or cancellations race with delivery
* A design that can be moved from JSON storage to a transactional database when scaling to multiple workers


## State transitions

`scheduled -> running -> delivered`  
`scheduled -> running -> scheduled` (retryable failure)  
`scheduled -> running -> failed` (permanent/exhausted)  
`scheduled -> cancelled`

Restart recovery is `running -> scheduled`; the interrupted attempt remains in ordered history as `abandoned`.
