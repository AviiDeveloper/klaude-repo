export interface LatencyRecord {
  session_id: string;
  source: "openclaw" | "local";
  ack_latency_ms: number;
  total_latency_ms: number;
  created_at: string;
}

export class LatencyTracker {
  private readonly records: LatencyRecord[] = [];

  record(input: {
    sessionId: string;
    source: "openclaw" | "local";
    ackLatencyMs: number;
    totalLatencyMs: number;
  }): LatencyRecord {
    const record: LatencyRecord = {
      session_id: input.sessionId,
      source: input.source,
      ack_latency_ms: input.ackLatencyMs,
      total_latency_ms: input.totalLatencyMs,
      created_at: new Date().toISOString(),
    };
    this.records.push(record);
    if (this.records.length > 500) {
      this.records.shift();
    }
    return record;
  }

  snapshot(): {
    count: number;
    avg_ack_latency_ms: number;
    avg_total_latency_ms: number;
    last?: LatencyRecord;
  } {
    if (this.records.length === 0) {
      return {
        count: 0,
        avg_ack_latency_ms: 0,
        avg_total_latency_ms: 0,
      };
    }

    const totalAck = this.records.reduce((sum, r) => sum + r.ack_latency_ms, 0);
    const totalOverall = this.records.reduce((sum, r) => sum + r.total_latency_ms, 0);

    return {
      count: this.records.length,
      avg_ack_latency_ms: Math.round(totalAck / this.records.length),
      avg_total_latency_ms: Math.round(totalOverall / this.records.length),
      last: this.records[this.records.length - 1],
    };
  }
}
