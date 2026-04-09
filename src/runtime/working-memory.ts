/**
 * Working Memory — per-run scratchpad for inter-agent communication.
 *
 * Agents within a pipeline run can read/write shared state through this
 * interface. Data lives in-memory during the run and is flushed to SQLite
 * (episodes table) on completion.
 */

export interface WorkingMemoryNote {
  note: string;
  author: string;
  timestamp: string;
}

export interface WorkingMemory {
  readonly runId: string;

  /** Set a shared key visible to all agents in this run. */
  set(key: string, value: unknown): void;

  /** Get a shared value by key. */
  get<T = unknown>(key: string): T | undefined;

  /** Set a key scoped to a specific agent (namespace: agentId/key). */
  setForAgent(agentId: string, key: string, value: unknown): void;

  /** Read a key written by a specific agent. */
  getFromAgent(agentId: string, key: string): unknown;

  /** Append a free-text observation visible to downstream agents. */
  addNote(note: string, author: string): void;

  /** Retrieve all notes in chronological order. */
  getNotes(): WorkingMemoryNote[];

  /** Return a JSON-serialisable snapshot of all memory. */
  snapshot(): Record<string, unknown>;
}

export class InMemoryWorkingMemory implements WorkingMemory {
  private readonly shared = new Map<string, unknown>();
  private readonly agentScoped = new Map<string, unknown>();
  private readonly notes: WorkingMemoryNote[] = [];

  constructor(public readonly runId: string) {}

  set(key: string, value: unknown): void {
    this.shared.set(key, value);
  }

  get<T = unknown>(key: string): T | undefined {
    return this.shared.get(key) as T | undefined;
  }

  setForAgent(agentId: string, key: string, value: unknown): void {
    this.agentScoped.set(`${agentId}/${key}`, value);
  }

  getFromAgent(agentId: string, key: string): unknown {
    return this.agentScoped.get(`${agentId}/${key}`);
  }

  addNote(note: string, author: string): void {
    this.notes.push({ note, author, timestamp: new Date().toISOString() });
  }

  getNotes(): WorkingMemoryNote[] {
    return [...this.notes];
  }

  snapshot(): Record<string, unknown> {
    const shared: Record<string, unknown> = {};
    for (const [k, v] of this.shared) shared[k] = v;

    const scoped: Record<string, unknown> = {};
    for (const [k, v] of this.agentScoped) scoped[k] = v;

    return {
      shared,
      agentScoped: scoped,
      notes: this.notes,
    };
  }
}
