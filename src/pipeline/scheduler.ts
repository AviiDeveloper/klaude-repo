import { PipelineEngine } from "./engine.js";
import { SQLitePipelineStore } from "./sqlitePipelineStore.js";

export class PipelineScheduler {
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly store: SQLitePipelineStore,
    private readonly engine: PipelineEngine,
    private readonly tickMs = Number(process.env.SCHEDULER_TICK_MS ?? "60000"),
  ) {}

  start(): void {
    if (this.timer) {
      return;
    }
    this.timer = setInterval(() => {
      this.tick();
    }, this.tickMs);
  }

  stop(): void {
    if (!this.timer) {
      return;
    }
    clearInterval(this.timer);
    this.timer = undefined;
  }

  tick(): void {
    const now = new Date().toISOString();
    const due = this.store.listDueDefinitions(now);
    for (const definition of due) {
      void this.engine
        .startRun({
          definitionId: definition.id,
          trigger: "scheduler",
        })
        .catch((error) => {
          console.error("scheduler tick failed", definition.id, error);
        });
    }
  }
}
