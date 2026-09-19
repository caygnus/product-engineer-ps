import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { JsonStore } from '../src/store.js';
import { FakeClock } from '../src/clock.js';
import { MemoryDestination } from '../src/destination.js';
import { ReminderService } from '../src/service.js';
import { localToInstant } from '../src/time.js';

function setup(plan = {}, options = {}) { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rem-')); const clock = new FakeClock(); const dest = new MemoryDestination(plan); const service = new ReminderService({ store: new JsonStore(path.join(dir, 'db.json')), clock, destination: dest, retryDelayMs: 1000, ...options }); return { dir, clock, dest, service }; }
function due(s) { return s.create({ content: 'hello', timeZone: 'Asia/Kolkata', scheduledAt: '2026-01-01T00:00:00.000Z' }); }

test('due-work discovery delivers once', () => { const { service, dest } = setup(); const x = due(service); service.runDue(); assert.equal(service.get(x.id).state, 'delivered'); assert.equal(dest.logicalDeliveries(), 1); });
test('restart recovers overdue running work', () => { const { dir, clock, dest, service } = setup(); const x = due(service); service.store.update(db => { db.items[x.id].state = 'running'; db.items[x.id].attempts.push({ number: 1, startedAt: clock.now().toISOString() }); }); const restarted = new ReminderService({ store: new JsonStore(path.join(dir, 'db.json')), clock, destination: dest }); restarted.runDue(); assert.equal(restarted.get(x.id).state, 'delivered'); assert.equal(dest.logicalDeliveries(), 1); });
test('temporary failure retries then succeeds', () => { const { service, clock } = setup({ '*': ['temporary', 'success'] }); const x = due(service); service.runDue(); assert.equal(service.get(x.id).state, 'scheduled'); clock.advance(1000); service.runDue(); assert.equal(service.get(x.id).state, 'delivered'); assert.equal(service.get(x.id).attempts.length, 2); });
test('retry exhaustion becomes visible failed state', () => { const { service, clock } = setup({ '*': ['temporary', 'temporary', 'temporary'] }); const x = due(service); service.runDue(); clock.advance(1000); service.runDue(); clock.advance(2000); service.runDue(); assert.equal(service.get(x.id).state, 'failed'); assert.equal(service.get(x.id).attempts.length, 3); });
test('lost completion commit is redelivered as one logical notification', () => { const { service, dest } = setup(); const x = due(service); service.execute(x.id); service.store.update(db => { db.items[x.id].state = 'scheduled'; db.items[x.id].nextRunAt = '2026-01-01T00:00:00.000Z'; }); service.execute(x.id); assert.equal(dest.logicalDeliveries(), 1); assert.equal(dest.calls.length, 2); assert.equal(service.get(x.id).attempts.at(-1).outcome, 'duplicate-acknowledged'); });
test('edit and cancellation prevent superseded work', () => { const { service } = setup(); const x = due(service); service.edit(x.id, { content: 'new', scheduledAt: '2026-01-01T01:00:00.000Z' }); service.runDue(); assert.equal(service.get(x.id).state, 'scheduled'); service.cancel(x.id); service.runDue(); assert.equal(service.get(x.id).state, 'cancelled'); });
test('IANA zones and DST policies are deterministic', () => { assert.equal(localToInstant('2026-01-01T05:30', 'Asia/Kolkata'), '2026-01-01T00:00:00.000Z'); assert.equal(localToInstant('2026-11-01T01:30', 'America/New_York'), '2026-11-01T05:30:00.000Z'); assert.equal(localToInstant('2026-03-08T02:30', 'America/New_York'), '2026-03-08T07:00:00.000Z'); });
