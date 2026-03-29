import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { DemoRecorder, extractDesignElements } from "../demos/demoRecorder.js";
import { InMemoryDemoRecordStore } from "../demos/demoRecordStore.js";
import { SQLiteDemoRecordStore } from "../demos/sqliteDemoRecordStore.js";
import type { DesignElements, RecordDemoInput } from "../demos/types.js";

function makeDesignElements(overrides: Partial<DesignElements> = {}): DesignElements {
  return {
    colour_palette: ["#2563eb", "#f59e0b"],
    colour_source: "scraped",
    layout_type: "card",
    typography_pair: "Inter / Lato",
    hero_style: "gradient",
    section_order: ["hero", "services", "reviews", "cta", "footer"],
    sections_count: 5,
    colour_temperature: "cool",
    density: "medium",
    has_logo: true,
    has_hero_image: false,
    has_gallery: false,
    has_reviews: true,
    has_map: false,
    has_menu: false,
    ...overrides,
  };
}

function makeInput(overrides: Partial<RecordDemoInput> = {}): RecordDemoInput {
  return {
    leadId: "lead-001",
    html: "<html><body>Test</body></html>",
    css: "body { color: red; }",
    modelVersion: "ai-generated",
    scrapeQualityScore: 0.75,
    designElements: makeDesignElements(),
    ...overrides,
  };
}

test("record a demo and retrieve it", async () => {
  const store = new InMemoryDemoRecordStore();
  const recorder = new DemoRecorder(store);

  const demoId = await recorder.recordDemo(makeInput());
  assert.ok(demoId);

  const record = recorder.get(demoId);
  assert.ok(record);
  assert.equal(record.business_id, "lead-001");
  assert.equal(record.model_version, "ai-generated");
  assert.equal(record.scrape_quality_score, 0.75);
  assert.equal(record.quality_score, null);
  assert.equal(record.pitch_outcome, null);
});

test("design elements stored correctly", async () => {
  const store = new InMemoryDemoRecordStore();
  const recorder = new DemoRecorder(store);

  const demoId = await recorder.recordDemo(makeInput());
  const record = recorder.get(demoId)!;

  assert.deepEqual(record.design_elements.colour_palette, ["#2563eb", "#f59e0b"]);
  assert.equal(record.design_elements.colour_source, "scraped");
  assert.equal(record.design_elements.layout_type, "card");
  assert.equal(record.design_elements.typography_pair, "Inter / Lato");
  assert.equal(record.design_elements.hero_style, "gradient");
  assert.equal(record.design_elements.sections_count, 5);
  assert.equal(record.design_elements.colour_temperature, "cool");
  assert.equal(record.design_elements.density, "medium");
  assert.equal(record.design_elements.has_reviews, true);
  assert.equal(record.design_elements.has_map, false);
});

test("QA result update", async () => {
  const store = new InMemoryDemoRecordStore();
  const recorder = new DemoRecorder(store);

  const demoId = await recorder.recordDemo(makeInput());
  recorder.recordQaResult(demoId, 85, true);

  const record = recorder.get(demoId)!;
  assert.equal(record.quality_score, 85);
  assert.equal(record.quality_passed, true);
});

test("QA fail marks quality_passed false", async () => {
  const store = new InMemoryDemoRecordStore();
  const recorder = new DemoRecorder(store);

  const demoId = await recorder.recordDemo(makeInput());
  recorder.recordQaResult(demoId, 45, false);

  const record = recorder.get(demoId)!;
  assert.equal(record.quality_score, 45);
  assert.equal(record.quality_passed, false);
});

test("pitch outcome recording with salesperson data", async () => {
  const store = new InMemoryDemoRecordStore();
  const recorder = new DemoRecorder(store);

  const demoId = await recorder.recordDemo(makeInput());
  await recorder.recordPitchOutcome(demoId, {
    salespersonId: "sp-001",
    outcome: "closed",
    salespersonCloseRateAtTime: 0.12,
  });

  const record = recorder.get(demoId)!;
  assert.equal(record.salesperson_id, "sp-001");
  assert.equal(record.pitch_outcome, "closed");
  assert.equal(record.salesperson_close_rate_at_time, 0.12);
  assert.ok(record.pitched_at);
  assert.ok(record.outcome_logged_at);
  assert.equal(record.rejection_reason, null);
});

test("rejection outcome with reason", async () => {
  const store = new InMemoryDemoRecordStore();
  const recorder = new DemoRecorder(store);

  const demoId = await recorder.recordDemo(makeInput());
  await recorder.recordPitchOutcome(demoId, {
    salespersonId: "sp-002",
    outcome: "rejected",
    rejectionReason: "Already has a website",
    salespersonCloseRateAtTime: 0.08,
  });

  const record = recorder.get(demoId)!;
  assert.equal(record.pitch_outcome, "rejected");
  assert.equal(record.rejection_reason, "Already has a website");
});

test("query by business_id", async () => {
  const store = new InMemoryDemoRecordStore();
  const recorder = new DemoRecorder(store);

  await recorder.recordDemo(makeInput({ leadId: "lead-a" }));
  await recorder.recordDemo(makeInput({ leadId: "lead-b" }));
  await recorder.recordDemo(makeInput({ leadId: "lead-a" }));

  const results = recorder.getByBusiness("lead-a");
  assert.equal(results.length, 2);
  assert.ok(results.every((r) => r.business_id === "lead-a"));
});

test("list pending QA", async () => {
  const store = new InMemoryDemoRecordStore();
  const recorder = new DemoRecorder(store);

  const id1 = await recorder.recordDemo(makeInput());
  await recorder.recordDemo(makeInput({ leadId: "lead-b" }));

  recorder.recordQaResult(id1, 90, true);

  const pending = recorder.listPendingQa();
  assert.equal(pending.length, 1);
  assert.equal(pending[0].business_id, "lead-b");
});

test("list pending outcomes returns only pitched demos without outcome", async () => {
  const store = new InMemoryDemoRecordStore();
  const recorder = new DemoRecorder(store);

  const id1 = await recorder.recordDemo(makeInput()); // will be closed
  const id2 = await recorder.recordDemo(makeInput({ leadId: "lead-b" })); // unpitched — should NOT appear
  const id3 = await recorder.recordDemo(makeInput({ leadId: "lead-c" })); // pitched but no outcome — SHOULD appear

  await recorder.recordPitchOutcome(id1, {
    salespersonId: "sp-001",
    outcome: "closed",
    salespersonCloseRateAtTime: 0.1,
  });

  // Simulate pitched but no outcome by setting pitched_at directly
  const record3 = store.get(id3)!;
  record3.pitched_at = new Date().toISOString();

  const pending = recorder.listPendingOutcomes();
  assert.equal(pending.length, 1);
  assert.equal(pending[0].business_id, "lead-c");
});

test("extractDesignElements from site composer output", () => {
  const siteData: Record<string, unknown> = {
    lead_id: "lead-001",
    template_id: "restaurant-v1",
    site_name: "Test Restaurant",
    config_json: JSON.stringify({ primary_color: "#e74c3c", accent_color: "#f39c12" }),
    sections_count: 6,
    hero_variant: "image_overlay",
    font_pairing: "Playfair Display / Source Sans Pro",
    component_style: "bordered",
    brand_source: "logo",
    has_logo: true,
    has_hero_image: true,
    has_gallery: true,
    has_reviews: true,
    has_map: false,
    has_menu: true,
  };

  const elements = extractDesignElements(siteData);

  assert.deepEqual(elements.colour_palette, ["#e74c3c", "#f39c12"]);
  assert.equal(elements.colour_source, "logo");
  assert.equal(elements.layout_type, "bordered");
  assert.equal(elements.typography_pair, "Playfair Display / Source Sans Pro");
  assert.equal(elements.hero_style, "image_overlay");
  assert.equal(elements.sections_count, 6);
  assert.equal(elements.colour_temperature, "warm"); // #e74c3c is red
  assert.equal(elements.density, "medium"); // 6 sections
  assert.equal(elements.has_logo, true);
  assert.equal(elements.has_menu, true);
  assert.equal(elements.has_map, false);
});

test("extractDesignElements from AI-generated site with direct colour fields", () => {
  const siteData: Record<string, unknown> = {
    lead_id: "lead-ai",
    template_id: "ai-generated",
    config_json: "{}",
    colour_primary: "#e74c3c",
    colour_secondary: "#2ecc71",
    colour_accent: "#3498db",
    brand_source: "scraped",
    component_style: "glassmorphism",
    hero_variant: "split_image",
    font_pairing: "Montserrat / Open Sans",
    sections_count: 8,
    has_logo: true,
    has_hero_image: true,
    has_gallery: false,
    has_reviews: true,
    has_map: true,
    has_menu: false,
    ai_generated: true,
  };

  const elements = extractDesignElements(siteData);

  assert.deepEqual(elements.colour_palette, ["#e74c3c", "#2ecc71", "#3498db"]);
  assert.equal(elements.colour_source, "scraped");
  assert.equal(elements.colour_temperature, "warm"); // #e74c3c is red
  assert.equal(elements.density, "rich"); // 8 sections
  assert.equal(elements.layout_type, "glassmorphism");
});

test("extractDesignElements handles missing data", () => {
  const elements = extractDesignElements({});

  assert.deepEqual(elements.colour_palette, []);
  assert.equal(elements.colour_source, "vertical_default");
  assert.equal(elements.layout_type, "clean");
  assert.equal(elements.hero_style, "gradient");
  assert.equal(elements.sections_count, 3);
  assert.equal(elements.colour_temperature, "neutral");
  assert.equal(elements.density, "minimal");
});

test("SQLite persistence survives reload", async () => {
  const testDir = path.join(process.cwd(), "data-test", randomUUID());
  const dbPath = path.join(testDir, "test-demos.sqlite");

  try {
    const store1 = new SQLiteDemoRecordStore(dbPath);
    const recorder1 = new DemoRecorder(store1);

    const demoId = await recorder1.recordDemo(makeInput({ leadId: "persist-test" }));
    recorder1.recordQaResult(demoId, 88, true);
    await recorder1.recordPitchOutcome(demoId, {
      salespersonId: "sp-persist",
      outcome: "closed",
      salespersonCloseRateAtTime: 0.15,
    });

    // Reload from same DB
    const store2 = new SQLiteDemoRecordStore(dbPath);
    const recorder2 = new DemoRecorder(store2);

    const record = recorder2.get(demoId);
    assert.ok(record);
    assert.equal(record.business_id, "persist-test");
    assert.equal(record.quality_score, 88);
    assert.equal(record.quality_passed, true);
    assert.equal(record.pitch_outcome, "closed");
    assert.equal(record.salesperson_close_rate_at_time, 0.15);
    assert.deepEqual(record.design_elements.colour_palette, ["#2563eb", "#f59e0b"]);
    assert.equal(record.design_elements.hero_style, "gradient");
  } finally {
    await rm(testDir, { recursive: true, force: true });
  }
});

test("SQLite query with filters", async () => {
  const testDir = path.join(process.cwd(), "data-test", randomUUID());
  const dbPath = path.join(testDir, "test-query.sqlite");

  try {
    const store = new SQLiteDemoRecordStore(dbPath);
    const recorder = new DemoRecorder(store);

    const id1 = await recorder.recordDemo(makeInput({ leadId: "biz-a", modelVersion: "v1" }));
    await recorder.recordDemo(makeInput({ leadId: "biz-b", modelVersion: "v2" }));
    const id3 = await recorder.recordDemo(makeInput({ leadId: "biz-a", modelVersion: "v1" }));

    recorder.recordQaResult(id1, 90, true);
    recorder.recordQaResult(id3, 40, false);

    // Query by business
    const bizA = store.query({ business_id: "biz-a" });
    assert.equal(bizA.length, 2);

    // Query passed QA
    const passed = store.query({ quality_passed: true });
    assert.equal(passed.length, 1);
    assert.equal(passed[0].demo_id, id1);

    // Query pending QA
    const pendingQa = store.query({ pending_qa: true });
    assert.equal(pendingQa.length, 1);
    assert.equal(pendingQa[0].business_id, "biz-b");

    // Query by model version
    const v1 = store.query({ model_version: "v1" });
    assert.equal(v1.length, 2);
  } finally {
    await rm(testDir, { recursive: true, force: true });
  }
});
