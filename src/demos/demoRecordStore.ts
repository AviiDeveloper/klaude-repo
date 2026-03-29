import { DemoRecord, DemoQuery, PitchOutcomeInput } from "./types.js";

export interface DemoRecordStore {
  insert(record: DemoRecord): void;
  get(demoId: string): DemoRecord | undefined;
  getByBusiness(businessId: string): DemoRecord[];
  updateQuality(demoId: string, score: number, passed: boolean): void;
  updateScreenshot(demoId: string, screenshotUrl: string): void;
  updatePitchOutcome(demoId: string, outcome: PitchOutcomeInput): void;
  query(q: DemoQuery): DemoRecord[];
}

export class InMemoryDemoRecordStore implements DemoRecordStore {
  private readonly records = new Map<string, DemoRecord>();

  insert(record: DemoRecord): void {
    this.records.set(record.demo_id, record);
  }

  get(demoId: string): DemoRecord | undefined {
    return this.records.get(demoId);
  }

  getByBusiness(businessId: string): DemoRecord[] {
    return [...this.records.values()]
      .filter((r) => r.business_id === businessId)
      .sort((a, b) => (a.generated_at > b.generated_at ? -1 : 1));
  }

  updateQuality(demoId: string, score: number, passed: boolean): void {
    const record = this.records.get(demoId);
    if (!record) throw new Error(`Demo not found: ${demoId}`);
    record.quality_score = score;
    record.quality_passed = passed;
  }

  updateScreenshot(demoId: string, screenshotUrl: string): void {
    const record = this.records.get(demoId);
    if (!record) throw new Error(`Demo not found: ${demoId}`);
    record.screenshot_url = screenshotUrl;
  }

  updatePitchOutcome(demoId: string, outcome: PitchOutcomeInput): void {
    const record = this.records.get(demoId);
    if (!record) throw new Error(`Demo not found: ${demoId}`);
    record.salesperson_id = outcome.salespersonId;
    record.pitch_outcome = outcome.outcome;
    record.rejection_reason = outcome.rejectionReason ?? null;
    record.salesperson_close_rate_at_time = outcome.salespersonCloseRateAtTime;
    record.pitched_at = new Date().toISOString();
    record.outcome_logged_at = new Date().toISOString();
  }

  query(q: DemoQuery): DemoRecord[] {
    let results = [...this.records.values()];

    if (q.business_id) {
      results = results.filter((r) => r.business_id === q.business_id);
    }
    if (q.quality_passed !== undefined) {
      results = results.filter((r) => r.quality_passed === q.quality_passed);
    }
    if (q.has_outcome !== undefined) {
      results = q.has_outcome
        ? results.filter((r) => r.pitch_outcome !== null)
        : results.filter((r) => r.pitch_outcome === null);
    }
    if (q.pitched_no_outcome) {
      results = results.filter((r) => r.pitched_at !== null && r.pitch_outcome === null);
    }
    if (q.pending_qa) {
      results = results.filter((r) => r.quality_score === null);
    }
    if (q.model_version) {
      results = results.filter((r) => r.model_version === q.model_version);
    }
    if (q.since) {
      results = results.filter((r) => r.generated_at >= q.since!);
    }

    results.sort((a, b) => (a.generated_at > b.generated_at ? -1 : 1));

    if (q.limit) {
      results = results.slice(0, q.limit);
    }

    return results;
  }
}
