import type {
  Trace,
  TraceEvent,
  TraceEventType,
} from "./types";

export class Tracer {
  private readonly trace: Trace = {
    events: [],
  };

  private nextId = 1;

  record(
    type: TraceEventType,
    message: string,
    data?: Record<string, unknown>,
  ): void {
    const event: TraceEvent = {
      id: this.nextId++,
      timestamp: new Date().toISOString(),
      type,
      message,
      data,
    };

    this.trace.events.push(event);
  }

  getTrace(): Trace {
    return {
      events: [...this.trace.events],
    };
  }
}