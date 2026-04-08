#!/usr/bin/env npx tsx
/**
 * Generate a lead profile HTML report from the latest pipeline run.
 * Usage: npx tsx scripts/generate-report.ts [runId]
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { generateLeadReport } from "../src/reports/leadProfileReport.js";

const runId = process.argv[2] || undefined;
const dbPath = process.env.DB_PATH ?? "data/mvp.sqlite";

console.log(`Generating report from ${dbPath}...`);
if (runId) console.log(`Run ID: ${runId}`);
else console.log("Using latest completed run");

try {
  const html = generateLeadReport(runId, dbPath);

  mkdirSync("reports", { recursive: true });
  const filename = `reports/lead-report-${runId?.slice(0, 8) ?? "latest"}-${Date.now()}.html`;
  writeFileSync(filename, html);

  const sizeMB = (Buffer.byteLength(html) / 1024 / 1024).toFixed(1);
  console.log(`\nReport saved: ${filename} (${sizeMB} MB)`);

  // Open in default browser
  try {
    const absPath = new URL(filename, `file://${process.cwd()}/`).pathname;
    if (process.platform === "darwin") {
      execSync(`open "${absPath}"`);
    } else if (process.platform === "linux") {
      execSync(`xdg-open "${absPath}"`);
    }
    console.log("Opened in browser.");
  } catch {
    console.log("Could not auto-open. Open the file manually in your browser.");
  }
} catch (err) {
  console.error("Failed to generate report:", err);
  process.exit(1);
}
