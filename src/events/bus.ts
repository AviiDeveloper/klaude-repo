export type EventName =
  | "task.created"
  | "agent.requested"
  | "agent.completed"
  | "approval.requested"
  | "approval.resolved"
  | "notify.requested";

export interface Event<T = Record<string, unknown>> {
  name: EventName;
  payload: T;
  at: string;
}

type Listener<T> = (event: Event<T>) => void | Promise<void>;

/** Common interface for all event bus implementations */
export interface EventBus {
  subscribe<T>(name: EventName, listener: Listener<T>): void;
  publish<T>(name: EventName, payload: T): Promise<void>;
}

export class InMemoryEventBus implements EventBus {
  private listeners = new Map<EventName, Array<Listener<unknown>>>();

  subscribe<T>(name: EventName, listener: Listener<T>): void {
    const existing = this.listeners.get(name) ?? [];
    this.listeners.set(name, [...existing, listener as Listener<unknown>]);
  }

  async publish<T>(name: EventName, payload: T): Promise<void> {
    const event: Event<T> = { name, payload, at: new Date().toISOString() };
    const listeners = this.listeners.get(name) ?? [];
    for (const listener of listeners) {
      await listener(event as Event<unknown>);
    }
  }
}
