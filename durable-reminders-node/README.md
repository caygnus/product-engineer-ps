# Durable reminders and follow-ups (Node.js)

This is a small, dependency-free Node 20 service that treats a JSON file as the durable schedule store. It uses an injected clock and local fake notification destination, so all behaviour is deterministic.

## Run

```powershell
C:\Users\ASUS\Documents\solution\product-engineer-ps\durable-reminders-node> 
node --test
node benchmark.js
```

`npm test` and `npm run benchmark` are equivalent where npm is installed correctly; the project has no external packages.

The benchmark creates 20 items in `Asia/Kolkata` and `America/New_York`, edits and cancels items, injects temporary and permanent failures, restarts before all processing completes, re-executes an occurrence, advances the fake clock, and prints terminal counts plus logical-delivery evidence.

## Design decisions

- **Time zones:** callers may supply a UTC `scheduledAt` or `localTime` (`YYYY-MM-DDTHH:mm`) plus IANA zone. Local times convert with `Intl`: an ambiguous fall-back value selects the *earlier* instant; a nonexistent spring-forward value advances to the next valid local minute. The original zone and requested local time are retained.
- **Discovery and claiming:** polling reads durable items in `scheduled` state whose `nextRunAt <= clock.now`, then atomically changes one to `running` and appends an attempt. No in-memory timer is authoritative. On startup, interrupted `running` attempts are recorded as `abandoned` and made immediately due.
- **Retry:** only errors marked `retryable` are retried; limit is three total attempts with exponential delays (1, 2 seconds in the demo). Permanent errors and exhausted retries enter visible `failed` state.
- **Occurrence identity/idempotency:** every version that changes scheduled time gets a new random `deliveryKey`. The destination persists/uses that key as its idempotency key. If the process dies after destination acceptance and before it records `delivered`, redelivery receives a duplicate acknowledgement rather than emitting a second logical notification.
- **Edits/cancellation race:** edits and cancellations are valid only while `scheduled`. Claiming atomically moves an item to `running`; subsequent edit/cancel returns a conflict, so a caller knows delivery has crossed the execution boundary. Before claim, a new version replaces the old schedule (and its delivery key); cancellation prevents all future claims. This is deterministic and avoids pretending a notification can be withdrawn after its delivery boundary.
- **Multiple workers:** atomic JSON rename protects individual writes but is intentionally single-process. Multiple workers require a real transactional database with compare-and-swap/lease claims; destination-level idempotency still prevents duplicate logical notifications across a crash/retry boundary.

## State transitions

`scheduled -> running -> delivered`  
`scheduled -> running -> scheduled` (retryable failure)  
`scheduled -> running -> failed` (permanent/exhausted)  
`scheduled -> cancelled`

Restart recovery is `running -> scheduled`; the interrupted attempt remains in ordered history as `abandoned`.
