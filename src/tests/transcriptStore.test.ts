import { describe, test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import path from "node:path";
import { SQLiteSessionTranscriptStore } from "../transcript/sqliteSessionTranscriptStore.js";

describe("SQLiteSessionTranscriptStore", () => {
  const testDir = path.join(process.cwd(), "data-test", randomUUID());
  const dbPath = path.join(testDir, "transcripts.sqlite");
  let store: SQLiteSessionTranscriptStore;

  beforeEach(() => {
    store = new SQLiteSessionTranscriptStore(dbPath);
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  test("appends and retrieves transcript entry by session", async () => {
    await store.append({
      session_id: "sess1",
      user_id: "u1",
      timestamp: new Date().toISOString(),
      direction: "user",
      kind: "message",
      text: "Hello world",
      event_type: "message_received",
    });
    const entries = await store.listBySession("sess1");
    assert.equal(entries.length, 1);
    assert.equal(entries[0].text, "Hello world");
    assert.equal(entries[0].direction, "user");
    assert.equal(entries[0].kind, "message");
  });

  test("entries are ordered by insertion order", async () => {
    await store.append({
      session_id: "sess1", user_id: "u1", timestamp: "2025-01-01T00:00:00Z",
      direction: "user", kind: "message", text: "First", event_type: "msg",
    });
    await store.append({
      session_id: "sess1", user_id: "u1", timestamp: "2025-01-01T00:01:00Z",
      direction: "assistant", kind: "message", text: "Second", event_type: "msg",
    });
    await store.append({
      session_id: "sess1", user_id: "u1", timestamp: "2025-01-01T00:02:00Z",
      direction: "user", kind: "voice_final", text: "Third", event_type: "voice",
    });
    const entries = await store.listBySession("sess1");
    assert.equal(entries.length, 3);
    assert.equal(entries[0].text, "First");
    assert.equal(entries[1].text, "Second");
    assert.equal(entries[2].text, "Third");
  });

  test("entries from different sessions are isolated", async () => {
    await store.append({
      session_id: "sess1", user_id: "u1", timestamp: new Date().toISOString(),
      direction: "user", kind: "message", text: "Session 1", event_type: "msg",
    });
    await store.append({
      session_id: "sess2", user_id: "u1", timestamp: new Date().toISOString(),
      direction: "user", kind: "message", text: "Session 2", event_type: "msg",
    });
    const s1 = await store.listBySession("sess1");
    const s2 = await store.listBySession("sess2");
    assert.equal(s1.length, 1);
    assert.equal(s2.length, 1);
    assert.equal(s1[0].text, "Session 1");
    assert.equal(s2[0].text, "Session 2");
  });

  test("listSessions returns all sessions with counts", async () => {
    await store.append({
      session_id: "sess1", user_id: "u1", timestamp: "2025-01-01T00:00:00Z",
      direction: "user", kind: "message", text: "A", event_type: "msg",
    });
    await store.append({
      session_id: "sess1", user_id: "u1", timestamp: "2025-01-01T00:01:00Z",
      direction: "assistant", kind: "message", text: "B", event_type: "msg",
    });
    await store.append({
      session_id: "sess2", user_id: "u2", timestamp: "2025-01-02T00:00:00Z",
      direction: "user", kind: "message", text: "C", event_type: "msg",
    });
    const sessions = await store.listSessions();
    assert.equal(sessions.length, 2);
    // Ordered by last_event_at DESC
    assert.equal(sessions[0].session_id, "sess2");
    assert.equal(sessions[0].entries_count, 1);
    assert.equal(sessions[1].session_id, "sess1");
    assert.equal(sessions[1].entries_count, 2);
  });

  test("metadata is preserved as JSON", async () => {
    await store.append({
      session_id: "sess1", user_id: "u1", timestamp: new Date().toISOString(),
      direction: "system", kind: "session_start", text: "Started",
      event_type: "session_started",
      metadata: { source: "openclaw", version: "1.0" },
    });
    const entries = await store.listBySession("sess1");
    assert.equal(entries.length, 1);
    assert.deepEqual(entries[0].metadata, { source: "openclaw", version: "1.0" });
  });

  test("listBySession returns empty for unknown session", async () => {
    const entries = await store.listBySession("nonexistent");
    assert.equal(entries.length, 0);
  });

  test("listSessions returns empty when no data", async () => {
    const sessions = await store.listSessions();
    assert.equal(sessions.length, 0);
  });

  test("handles all direction types", async () => {
    const directions = ["user", "assistant", "system"] as const;
    for (const dir of directions) {
      await store.append({
        session_id: "sess1", user_id: "u1", timestamp: new Date().toISOString(),
        direction: dir, kind: "message", text: dir, event_type: "msg",
      });
    }
    const entries = await store.listBySession("sess1");
    assert.equal(entries.length, 3);
  });

  test("handles all kind types", async () => {
    const kinds = ["message", "voice_partial", "voice_final", "session_start", "session_end"] as const;
    for (const kind of kinds) {
      await store.append({
        session_id: "sess1", user_id: "u1", timestamp: new Date().toISOString(),
        direction: "user", kind, text: kind, event_type: "test",
      });
    }
    const entries = await store.listBySession("sess1");
    assert.equal(entries.length, 5);
  });
});
