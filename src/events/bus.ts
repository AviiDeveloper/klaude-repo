export type EventName =
  | "task.created"
  | "agent.requested"
  | "agent.completed"
  | "approval.requested"
  | "approval.resolved"
  | "notify.requested"
  | "pipeline.run.started"
  | "pipeline.run.completed"
  | "pipeline.run.failed"
  | "pipeline.node.started"
  | "pipeline.node.completed"
  | "pipeline.node.failed"
  | "reflection.iteration"
  | "working_memory.flushed";

export interface Event<T = Record<string, unknown>> {
  name: EventName;
  payload: T;
  at: string;
  correlation_id?: string;
}

type Listener<T> = (event: Event<T>) => void | Promise<void>;

/** Common interface for all event bus implementations */
export interface EventBus {
  subscribe<T>(name: EventName, listener: Listener<T>): void;
  publish<T>(name: EventName, payload: T, correlationId?: string): Promise<void>;
}

export class InMemoryEventBus implements EventBus {
  private listeners = new Map<EventName, Array<Listener<unknown>>>();

  subscribe<T>(name: EventName, listener: Listener<T>): void {
    const existing = this.listeners.get(name) ?? [];
    this.listeners.set(name, [...existing, listener as Listener<unknown>]);
  }

  async publish<T>(name: EventName, payload: T, correlationId?: string): Promise<void> {
    const event: Event<T> = { name, payload, at: new Date().toISOString(), correlation_id: correlationId };
    const listeners = this.listeners.get(name) ?? [];
    for (const listener of listeners) {
      await listener(event as Event<unknown>);
    }
  }
}
