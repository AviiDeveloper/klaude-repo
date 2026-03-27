import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { InMemoryEventBus, type EventName } from "../events/bus.js";

describe("InMemoryEventBus", () => {
  test("publishes event to single subscriber", async () => {
    const bus = new InMemoryEventBus();
    const received: unknown[] = [];
    bus.subscribe("task.created", (e) => { received.push(e.payload); });
    await bus.publish("task.created", { id: "t1" });
    assert.equal(received.length, 1);
    assert.deepEqual(received[0], { id: "t1" });
  });

  test("publishes event to multiple subscribers", async () => {
    const bus = new InMemoryEventBus();
    let countA = 0;
    let countB = 0;
    bus.subscribe("agent.completed", () => { countA++; });
    bus.subscribe("agent.completed", () => { countB++; });
    await bus.publish("agent.completed", {});
    assert.equal(countA, 1);
    assert.equal(countB, 1);
  });

  test("does not deliver events to unrelated subscribers", async () => {
    const bus = new InMemoryEventBus();
    let called = false;
    bus.subscribe("task.created", () => { called = true; });
    await bus.publish("approval.requested", {});
    assert.equal(called, false);
  });

  test("delivers events with correct timestamp", async () => {
    const bus = new InMemoryEventBus();
    let receivedAt = "";
    bus.subscribe("notify.requested", (e) => { receivedAt = e.at; });
    const before = new Date().toISOString();
    await bus.publish("notify.requested", {});
    const after = new Date().toISOString();
    assert.ok(receivedAt >= before);
    assert.ok(receivedAt <= after);
  });

  test("delivers events with correct name", async () => {
    const bus = new InMemoryEventBus();
    let receivedName: EventName | undefined;
    bus.subscribe("approval.resolved", (e) => { receivedName = e.name; });
    await bus.publish("approval.resolved", {});
    assert.equal(receivedName, "approval.resolved");
  });

  test("handles async subscribers", async () => {
    const bus = new InMemoryEventBus();
    const order: number[] = [];
    bus.subscribe("task.created", async () => {
      await new Promise((r) => setTimeout(r, 10));
      order.push(1);
    });
    bus.subscribe("task.created", async () => {
      order.push(2);
    });
    await bus.publish("task.created", {});
    assert.deepEqual(order, [1, 2]);
  });

  test("publish with no subscribers does not throw", async () => {
    const bus = new InMemoryEventBus();
    await bus.publish("agent.requested", { something: true });
  });

  test("supports all event names", async () => {
    const bus = new InMemoryEventBus();
    const names: EventName[] = [
      "task.created", "agent.requested", "agent.completed",
      "approval.requested", "approval.resolved", "notify.requested",
    ];
    const received: EventName[] = [];
    for (const name of names) {
      bus.subscribe(name, (e) => { received.push(e.name); });
    }
    for (const name of names) {
      await bus.publish(name, {});
    }
    assert.deepEqual(received, names);
  });
});
