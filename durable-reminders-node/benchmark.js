import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { JsonStore } from './src/store.js';
import { FakeClock } from './src/clock.js';
import { MemoryDestination } from './src/destination.js';
import { ReminderService } from './src/service.js';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'durable-reminders-benchmark-'));
const clock = new FakeClock(); const storeFile = path.join(dir, 'db.json');
const destination = new MemoryDestination();
let service = new ReminderService({ store: new JsonStore(storeFile), clock, destination, retryDelayMs: 1000, maxAttempts: 3 });
const ids = [];
for (let n = 0; n < 20; n++) ids.push(service.create({ content: `item ${n}`, timeZone: n % 2 ? 'America/New_York' : 'Asia/Kolkata', scheduledAt: '2026-01-01T00:00:00.000Z' }).id);
service.edit(ids[1], { content: 'edited', scheduledAt: '2026-01-01T00:00:02.000Z' }); service.cancel(ids[2]);
destination.plan[(service.get(ids[3])).deliveryKey] = ['temporary', 'success'];
destination.plan[(service.get(ids[4])).deliveryKey] = ['permanent'];
// Process a subset, then recreate the service as a restart. Execute one ID twice deliberately.
service.runDue({ limit: 8 });
// Simulate a crash after destination acceptance but before the completion write.
service.store.update(db => { db.items[ids[0]].state = 'scheduled'; db.items[ids[0]].nextRunAt = clock.now().toISOString(); });
service.execute(ids[0]);
service = new ReminderService({ store: new JsonStore(storeFile), clock, destination, retryDelayMs: 1000, maxAttempts: 3 });
for (let i = 0; i < 5; i++) { service.runDue(); clock.advance(2000); }
const items = service.list(); const counts = Object.groupBy(items, x => x.state);
console.log(JSON.stringify({ counts: Object.fromEntries(Object.entries(counts).map(([k,v]) => [k, v.length])), logicalNotifications: destination.logicalDeliveries(), activeSuccessfulOccurrences: items.filter(x => x.state === 'delivered').length, duplicateDestinationCalls: destination.calls.length - destination.logicalDeliveries() }, null, 2));
