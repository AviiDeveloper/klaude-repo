import { Task } from "../types/task.js";

export interface TaskStore {
  save(task: Task): Task;
  get(taskId: string): Task | undefined;
  list(): Task[];
  update(taskId: string, updater: (task: Task) => Task): Task;
}

export class InMemoryTaskStore implements TaskStore {
  private readonly tasks = new Map<string, Task>();

  save(task: Task): Task {
    this.tasks.set(task.id, task);
    return task;
  }

  get(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  list(): Task[] {
    return [...this.tasks.values()];
  }

  update(taskId: string, updater: (task: Task) => Task): Task {
    const existing = this.tasks.get(taskId);
    if (!existing) {
      throw new Error(`Task not found: ${taskId}`);
    }
    const next = updater(existing);
    this.tasks.set(taskId, next);
    return next;
  }
}
