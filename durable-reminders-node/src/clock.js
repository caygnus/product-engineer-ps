export class FakeClock {
  constructor(iso = '2026-01-01T00:00:00.000Z') { this.ms = Date.parse(iso); }
  now() { return new Date(this.ms); }
  advance(ms) { this.ms += ms; }
}

export class SystemClock { now() { return new Date(); } }
