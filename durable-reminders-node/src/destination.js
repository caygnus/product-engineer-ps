// The delivery boundary itself is idempotent: a repeated key is acknowledged, not re-notified.
export class MemoryDestination {
  constructor(plan = {}) { this.plan = plan; this.seen = new Map(); this.calls = []; }
  deliver({ key, content }) {
    this.calls.push(key);
    if (this.seen.has(key)) return { duplicate: true };
    const action = (this.plan[key] || this.plan['*'] || []).shift() || 'success';
    if (action === 'temporary') { const e = new Error('temporary destination outage'); e.retryable = true; throw e; }
    if (action === 'permanent') { const e = new Error('invalid destination'); e.retryable = false; throw e; }
    this.seen.set(key, content);
    return { duplicate: false };
  }
  logicalDeliveries() { return this.seen.size; }
}
