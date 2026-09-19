import crypto from 'node:crypto';
import { localToInstant } from './time.js';

const ACTIVE = new Set(['scheduled', 'running']);
const id = () => crypto.randomUUID();
const iso = d => new Date(d).toISOString();

export class ReminderService {
  constructor({ store, clock, destination, maxAttempts = 3, retryDelayMs = 60_000 }) {
    Object.assign(this, { store, clock, destination, maxAttempts, retryDelayMs });
    this.recoverInterruptedWork();
  }
  create({ kind = 'reminder', content, timeZone, localTime, scheduledAt }) {
    const at = scheduledAt || localToInstant(localTime, timeZone);
    const item = { id: id(), kind, content, timeZone, requestedLocalTime: localTime || null,
      scheduledAt: at, nextRunAt: at, state: 'scheduled', version: 1,
      deliveryKey: id(), attempts: [], createdAt: iso(this.clock.now()), updatedAt: iso(this.clock.now()) };
    this.store.update(db => { db.items[item.id] = item; });
    return item;
  }
  get(itemId) { return this.store.read().items[itemId] || null; }
  list() { return Object.values(this.store.read().items); }
  edit(itemId, patch) {
    return this.store.update(db => {
      const x = this.#require(db, itemId);
      if (x.state !== 'scheduled') throw new Error(`cannot edit ${x.state} item`);
      if (patch.content !== undefined) x.content = patch.content;
      if (patch.timeZone !== undefined) x.timeZone = patch.timeZone;
      if (patch.localTime !== undefined) { x.requestedLocalTime = patch.localTime; x.scheduledAt = localToInstant(patch.localTime, x.timeZone); }
      if (patch.scheduledAt !== undefined) x.scheduledAt = patch.scheduledAt;
      if (patch.localTime !== undefined || patch.scheduledAt !== undefined) { x.nextRunAt = x.scheduledAt; x.deliveryKey = id(); }
      x.version++; x.updatedAt = iso(this.clock.now()); return x;
    });
  }
  cancel(itemId) {
    return this.store.update(db => {
      const x = this.#require(db, itemId);
      if (x.state !== 'scheduled') throw new Error(`cannot cancel ${x.state} item`);
      x.state = 'cancelled'; x.version++; x.updatedAt = iso(this.clock.now()); return x;
    });
  }
  recoverInterruptedWork() {
    const now = iso(this.clock.now());
    this.store.update(db => { for (const x of Object.values(db.items)) if (x.state === 'running') {
      x.state = 'scheduled'; x.nextRunAt = now; x.updatedAt = now;
      const a = x.attempts.at(-1); if (a && !a.outcome) { a.outcome = 'abandoned'; a.finishedAt = now; }
    }});
  }
  runDue({ limit = 100 } = {}) {
    const now = iso(this.clock.now());
    const due = this.list().filter(x => x.state === 'scheduled' && x.nextRunAt <= now)
      .sort((a, b) => a.nextRunAt.localeCompare(b.nextRunAt)).slice(0, limit);
    return due.map(x => this.#runOne(x.id));
  }
  // Public for tests/schedulers that accidentally execute the same claimed occurrence twice.
  execute(itemId) { return this.#runOne(itemId); }
  #runOne(itemId) {
    const claim = this.store.update(db => {
      const x = this.#require(db, itemId); const now = iso(this.clock.now());
      if (x.state !== 'scheduled' || x.nextRunAt > now) return null;
      x.state = 'running';
      const attempt = { number: x.attempts.length + 1, version: x.version, key: x.deliveryKey, startedAt: now };
      x.attempts.push(attempt); x.updatedAt = now;
      return { version: x.version, key: x.deliveryKey, content: x.content, attempt: attempt.number };
    });
    if (!claim) return { skipped: true };
    try {
      const receipt = this.destination.deliver({ key: claim.key, content: claim.content });
      return this.store.update(db => {
        const x = this.#require(db, itemId); const a = x.attempts.at(-1);
        a.outcome = receipt.duplicate ? 'duplicate-acknowledged' : 'delivered'; a.finishedAt = iso(this.clock.now());
        x.state = 'delivered'; x.updatedAt = iso(this.clock.now()); return x;
      });
    } catch (error) {
      return this.store.update(db => {
        const x = this.#require(db, itemId); const a = x.attempts.at(-1);
        a.outcome = 'failed'; a.error = error.message; a.retryable = Boolean(error.retryable); a.finishedAt = iso(this.clock.now());
        if (error.retryable && a.number < this.maxAttempts) { x.state = 'scheduled'; x.nextRunAt = iso(this.clock.now().getTime() + this.retryDelayMs * 2 ** (a.number - 1)); }
        else x.state = 'failed';
        x.updatedAt = iso(this.clock.now()); return x;
      });
    }
  }
  #require(db, itemId) { const x = db.items[itemId]; if (!x) throw new Error(`unknown item ${itemId}`); return x; }
}

export { ACTIVE };
