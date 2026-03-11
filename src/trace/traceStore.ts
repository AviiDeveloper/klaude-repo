import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Task } from "../types/task.js";
import {
  ExecutionTraceRecord,
  TimelineEvent,
  TraceSideEffect,
} from "./types.js";

interface TraceStoreOptions {
  tracesDir: string;
  buildVersion: string;
  changelogChangeId: string;
}

export interface TraceStore {
  create(task: Task): Promise<void>;
  appendTimeline(taskId: string, event: TimelineEvent): Promise<void>;
  finalize(input: {
    taskId: string;
    finalState: string;
    sideEffects: TraceSideEffect[];
    artifacts: string[];
  }): Promise<ExecutionTraceRecord>;
  read(taskId: string): Promise<ExecutionTraceRecord>;
}

export class FileTraceStore implements TraceStore {
  private readonly traces = new Map<string, ExecutionTraceRecord>();

  constructor(private readonly options: TraceStoreOptions) {}

  async create(task: Task): Promise<void> {
    await this.ensureDir();
    if (this.traces.has(task.id)) {
      throw new Error(`Trace already exists in memory for task: ${task.id}`);
    }

    if (await this.exists(this.tracePath(task.id))) {
      throw new Error(`Immutable trace already exists on disk: ${task.id}`);
    }

    this.traces.set(task.id, {
      task_id: task.id,
      objective: task.objective,
      created_at: task.created_at,
      build_version: this.options.buildVersion,
      changelog_change_id: this.options.changelogChangeId,
      final_state: "in_progress",
      timeline: [],
      approvals: [],
      side_effects: [],
      artifacts: [],
    });
  }

  async appendTimeline(taskId: string, event: TimelineEvent): Promise<void> {
    const trace = this.getMutable(taskId);
    trace.timeline.push(event);
    await this.appendEventsLog(taskId, { kind: "timeline", event });
  }

  async finalize(input: {
    taskId: string;
    finalState: string;
    sideEffects: TraceSideEffect[];
    artifacts: string[];
  }): Promise<ExecutionTraceRecord> {
    const trace = this.getMutable(input.taskId);
    trace.final_state = input.finalState;
    trace.side_effects = input.sideEffects;
    trace.artifacts = input.artifacts;

    const tracePath = this.tracePath(input.taskId);
    if (await this.exists(tracePath)) {
      throw new Error(`Refusing to overwrite immutable trace: ${input.taskId}`);
    }

    const snapshot = JSON.stringify(trace, null, 2);
    await writeFile(tracePath, `${snapshot}\n`, "utf8");
    await this.appendEventsLog(input.taskId, {
      kind: "finalized",
      final_state: input.finalState,
    });
    return trace;
  }

  async read(taskId: string): Promise<ExecutionTraceRecord> {
    const tracePath = this.tracePath(taskId);
    const content = await readFile(tracePath, "utf8");
    return JSON.parse(content) as ExecutionTraceRecord;
  }

  private getMutable(taskId: string): ExecutionTraceRecord {
    const trace = this.traces.get(taskId);
    if (!trace) {
      throw new Error(`Trace not initialized for task: ${taskId}`);
    }
    return trace;
  }

  private async appendEventsLog(
    taskId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.ensureDir();
    const line = JSON.stringify({ timestamp: new Date().toISOString(), ...payload });
    const eventsPath = this.eventsPath(taskId);

    let previous = "";
    if (await this.exists(eventsPath)) {
      previous = await readFile(eventsPath, "utf8");
    }

    await writeFile(eventsPath, `${previous}${line}\n`, "utf8");
  }

  private tracePath(taskId: string): string {
    return path.join(this.options.tracesDir, `${taskId}.trace.json`);
  }

  private eventsPath(taskId: string): string {
    return path.join(this.options.tracesDir, `${taskId}.events.jsonl`);
  }

  private async ensureDir(): Promise<void> {
    await mkdir(this.options.tracesDir, { recursive: true });
  }

  private async exists(target: string): Promise<boolean> {
    try {
      await stat(target);
      return true;
    } catch {
      return false;
    }
  }
}
