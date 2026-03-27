import { describe, test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import path from "node:path";
import { SQLiteNotificationStore } from "../notifications/sqliteNotificationStore.js";

describe("SQLiteNotificationStore", () => {
  const testDir = path.join(process.cwd(), "data-test", randomUUID());
  const dbPath = path.join(testDir, "notifications.sqlite");
  let store: SQLiteNotificationStore;

  beforeEach(() => {
    store = new SQLiteNotificationStore(dbPath);
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  test("appends a notification and returns it with id and pending status", async () => {
    const record = await store.append({
      event_id: "e1",
      created_at: new Date().toISOString(),
      channel: "notify_user",
      reason: "task_blocked",
      message: "Task is blocked",
      severity: "warning",
      session_id: "sess1",
      user_id: "u1",
    });
    assert.ok(record.id);
    assert.equal(record.status, "pending");
    assert.equal(record.channel, "notify_user");
    assert.equal(record.reason, "task_blocked");
    assert.equal(record.message, "Task is blocked");
    assert.equal(record.severity, "warning");
  });

  test("lists notifications ordered by created_at DESC", async () => {
    await store.append({
      event_id: "e1", created_at: "2025-01-01T00:00:00Z",
      channel: "notify_user", reason: "task_blocked", message: "First",
      severity: "info", session_id: "s1", user_id: "u1",
    });
    await store.append({
      event_id: "e2", created_at: "2025-01-02T00:00:00Z",
      channel: "notify_user", reason: "task_failed", message: "Second",
      severity: "critical", session_id: "s1", user_id: "u1",
    });
    const list = await store.list();
    assert.equal(list.length, 2);
    assert.equal(list[0].message, "Second");
    assert.equal(list[1].message, "First");
  });

  test("filters by channel", async () => {
    await store.append({
      event_id: "e1", created_at: new Date().toISOString(),
      channel: "notify_user", reason: "task_blocked", message: "Notify",
      severity: "info", session_id: "s1", user_id: "u1",
    });
    await store.append({
      event_id: "e2", created_at: new Date().toISOString(),
      channel: "call_user", reason: "task_failed", message: "Call",
      severity: "critical", session_id: "s1", user_id: "u1",
    });
    const filtered = await store.list({ channel: "call_user" });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].message, "Call");
  });

  test("filters by status", async () => {
    const r = await store.append({
      event_id: "e1", created_at: new Date().toISOString(),
      channel: "notify_user", reason: "task_blocked", message: "A",
      severity: "info", session_id: "s1", user_id: "u1",
    });
    await store.append({
      event_id: "e2", created_at: new Date().toISOString(),
      channel: "notify_user", reason: "task_failed", message: "B",
      severity: "info", session_id: "s1", user_id: "u1",
    });
    await store.acknowledge(r.id);
    const pending = await store.list({ status: "pending" });
    assert.equal(pending.length, 1);
    assert.equal(pending[0].message, "B");
    const acked = await store.list({ status: "acknowledged" });
    assert.equal(acked.length, 1);
    assert.equal(acked[0].message, "A");
  });

  test("filters by severity", async () => {
    await store.append({
      event_id: "e1", created_at: new Date().toISOString(),
      channel: "notify_user", reason: "task_blocked", message: "Info",
      severity: "info", session_id: "s1", user_id: "u1",
    });
    await store.append({
      event_id: "e2", created_at: new Date().toISOString(),
      channel: "notify_user", reason: "task_failed", message: "Critical",
      severity: "critical", session_id: "s1", user_id: "u1",
    });
    const critical = await store.list({ severity: "critical" });
    assert.equal(critical.length, 1);
    assert.equal(critical[0].message, "Critical");
  });

  test("filters by reason", async () => {
    await store.append({
      event_id: "e1", created_at: new Date().toISOString(),
      channel: "notify_user", reason: "budget_exceeded", message: "Budget",
      severity: "warning", session_id: "s1", user_id: "u1",
    });
    await store.append({
      event_id: "e2", created_at: new Date().toISOString(),
      channel: "notify_user", reason: "approval_required", message: "Approval",
      severity: "info", session_id: "s1", user_id: "u1",
    });
    const budgetOnly = await store.list({ reason: "budget_exceeded" });
    assert.equal(budgetOnly.length, 1);
    assert.equal(budgetOnly[0].message, "Budget");
  });

  test("respects limit", async () => {
    for (let i = 0; i < 5; i++) {
      await store.append({
        event_id: `e${i}`, created_at: new Date().toISOString(),
        channel: "notify_user", reason: "task_blocked", message: `M${i}`,
        severity: "info", session_id: "s1", user_id: "u1",
      });
    }
    const limited = await store.list({ limit: 2 });
    assert.equal(limited.length, 2);
  });

  test("acknowledge sets status and acknowledged_at", async () => {
    const r = await store.append({
      event_id: "e1", created_at: new Date().toISOString(),
      channel: "notify_user", reason: "task_blocked", message: "Test",
      severity: "info", session_id: "s1", user_id: "u1",
    });
    assert.equal(r.status, "pending");
    assert.equal(r.acknowledged_at, undefined);

    const acked = await store.acknowledge(r.id);
    assert.ok(acked);
    assert.equal(acked!.status, "acknowledged");
    assert.ok(acked!.acknowledged_at);
  });

  test("acknowledge returns undefined for non-existent id", async () => {
    const result = await store.acknowledge("nonexistent");
    assert.equal(result, undefined);
  });

  test("filters by task_id", async () => {
    await store.append({
      event_id: "e1", created_at: new Date().toISOString(),
      channel: "notify_user", reason: "task_blocked", message: "T1",
      severity: "info", session_id: "s1", user_id: "u1", task_id: "task-a",
    });
    await store.append({
      event_id: "e2", created_at: new Date().toISOString(),
      channel: "notify_user", reason: "task_failed", message: "T2",
      severity: "info", session_id: "s1", user_id: "u1", task_id: "task-b",
    });
    const filtered = await store.list({ task_id: "task-a" });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].message, "T1");
  });
});
