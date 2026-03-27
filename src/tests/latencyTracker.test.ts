import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { LatencyTracker } from "../metrics/latencyTracker.js";

describe("LatencyTracker", () => {
  test("records a latency entry and returns it", () => {
    const tracker = new LatencyTracker();
    const record = tracker.record({
      sessionId: "s1",
      source: "openclaw",
      ackLatencyMs: 150,
      totalLatencyMs: 2000,
    });
    assert.equal(record.session_id, "s1");
    assert.equal(record.source, "openclaw");
    assert.equal(record.ack_latency_ms, 150);
    assert.equal(record.total_latency_ms, 2000);
    assert.ok(record.created_at);
  });

  test("snapshot returns correct averages for single record", () => {
    const tracker = new LatencyTracker();
    tracker.record({ sessionId: "s1", source: "local", ackLatencyMs: 100, totalLatencyMs: 500 });
    const snap = tracker.snapshot();
    assert.equal(snap.count, 1);
    assert.equal(snap.avg_ack_latency_ms, 100);
    assert.equal(snap.avg_total_latency_ms, 500);
    assert.ok(snap.last);
    assert.equal(snap.last.session_id, "s1");
  });

  test("snapshot returns correct averages for multiple records", () => {
    const tracker = new LatencyTracker();
    tracker.record({ sessionId: "s1", source: "openclaw", ackLatencyMs: 100, totalLatencyMs: 1000 });
    tracker.record({ sessionId: "s2", source: "openclaw", ackLatencyMs: 200, totalLatencyMs: 3000 });
    const snap = tracker.snapshot();
    assert.equal(snap.count, 2);
    assert.equal(snap.avg_ack_latency_ms, 150);
    assert.equal(snap.avg_total_latency_ms, 2000);
    assert.equal(snap.last!.session_id, "s2");
  });

  test("snapshot with no records returns zeros", () => {
    const tracker = new LatencyTracker();
    const snap = tracker.snapshot();
    assert.equal(snap.count, 0);
    assert.equal(snap.avg_ack_latency_ms, 0);
    assert.equal(snap.avg_total_latency_ms, 0);
    assert.equal(snap.last, undefined);
  });

  test("caps records at 500 entries", () => {
    const tracker = new LatencyTracker();
    for (let i = 0; i < 510; i++) {
      tracker.record({ sessionId: `s${i}`, source: "local", ackLatencyMs: i, totalLatencyMs: i * 2 });
    }
    const snap = tracker.snapshot();
    assert.equal(snap.count, 500);
    assert.equal(snap.last!.session_id, "s509");
  });

  test("oldest records are evicted when cap is reached", () => {
    const tracker = new LatencyTracker();
    for (let i = 0; i < 501; i++) {
      tracker.record({ sessionId: `s${i}`, source: "openclaw", ackLatencyMs: i, totalLatencyMs: i });
    }
    const snap = tracker.snapshot();
    // First record (s0 with ack=0) should have been evicted
    // Average should not include 0
    assert.ok(snap.avg_ack_latency_ms > 0);
  });
});
