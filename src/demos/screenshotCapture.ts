/**
 * Screenshot Capture — renders demo HTML in headless Playwright and captures PNG.
 *
 * Gracefully returns null if Playwright browsers aren't installed,
 * so the pipeline never breaks due to missing screenshot tooling.
 */

import { saveScreenshot } from "../lib/assetStore.js";

interface ScreenshotResult {
  path: string;
  width: number;
  height: number;
  sizeBytes: number;
}

/**
 * Render HTML in a headless browser and capture a screenshot.
 * Returns null if Playwright is unavailable or capture fails.
 */
export async function captureDemo(
  html: string,
  leadId: string,
  demoId: string,
): Promise<ScreenshotResult | null> {
  let chromium: typeof import("playwright-core").chromium;
  try {
    const pw = await import("playwright-core");
    chromium = pw.chromium;
  } catch {
    return null;
  }

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

    await page.setContent(html, { waitUntil: "networkidle", timeout: 15_000 });

    const buffer = await page.screenshot({
      type: "png",
      fullPage: false,
    });

    const filename = `demo-${demoId}.png`;
    const meta = await saveScreenshot(leadId, filename, Buffer.from(buffer));

    return {
      path: meta.filename,
      width: meta.width ?? 1280,
      height: meta.height ?? 800,
      sizeBytes: meta.size_bytes ?? buffer.byteLength,
    };
  } catch {
    return null;
  } finally {
    if (browser) {
      try { await browser.close(); } catch { /* ignore */ }
    }
  }
}
