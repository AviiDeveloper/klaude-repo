import { AgentHandler } from "../../pipeline/agentRuntime.js";

interface GeneratedSite {
  lead_id?: string;
  site_name: string;
  html_output: string;
  css_output: string;
  business_name?: string;
  domain?: string;
}

interface QaIssue {
  severity: "error" | "warning" | "info";
  message: string;
}

/**
 * Validates generated landing pages for quality.
 * Checks: HTML validity, placeholder leaks, content quality,
 * mobile responsiveness signals, and basic SEO.
 */
export const siteQaAgent: AgentHandler = async (input) => {
  const upstream = input.upstreamArtifacts as Record<string, { sites?: GeneratedSite[] }>;

  const sites: GeneratedSite[] = [];
  for (const nodeOutput of Object.values(upstream)) {
    if (nodeOutput?.sites) sites.push(...nodeOutput.sites);
  }

  if (sites.length === 0) {
    return {
      summary: "No sites to QA.",
      artifacts: { results: [], qa_count: 0 },
    };
  }

  const results: Array<Record<string, unknown>> = [];

  for (const site of sites) {
    const issues: QaIssue[] = [];
    const html = site.html_output;
    const htmlLower = html.toLowerCase();

    // 1. Check for leftover template placeholders
    const placeholderMatches = html.match(/\{\{[^}]+\}\}/g);
    if (placeholderMatches && placeholderMatches.length > 0) {
      issues.push({
        severity: "error",
        message: `${placeholderMatches.length} unfilled placeholder(s): ${placeholderMatches.slice(0, 3).join(", ")}`,
      });
    }

    // 2. Check HTML structure
    if (!htmlLower.includes("<!doctype html>")) {
      issues.push({ severity: "error", message: "Missing DOCTYPE declaration" });
    }
    if (!htmlLower.includes("<meta charset")) {
      issues.push({ severity: "warning", message: "Missing charset meta tag" });
    }
    if (!htmlLower.includes("viewport")) {
      issues.push({ severity: "error", message: "Missing viewport meta tag — not mobile friendly" });
    }
    if (!htmlLower.includes("<title>")) {
      issues.push({ severity: "error", message: "Missing <title> tag" });
    }
    if (!htmlLower.includes("<meta name=\"description\"")) {
      issues.push({ severity: "warning", message: "Missing meta description — hurts SEO" });
    }

    // 3. Check content quality
    if (html.length < 1000) {
      issues.push({ severity: "warning", message: "Very short content — may appear thin" });
    }
    if (htmlLower.includes("lorem ipsum") || htmlLower.includes("placeholder")) {
      issues.push({ severity: "error", message: "Contains placeholder/lorem ipsum text" });
    }
    if (htmlLower.includes("example.com") || htmlLower.includes("example.invalid")) {
      issues.push({ severity: "warning", message: "Contains example URLs" });
    }

    // 4. Check phone/contact presence
    if (!htmlLower.includes("tel:")) {
      issues.push({ severity: "warning", message: "No clickable phone link found" });
    }
    if (!htmlLower.includes("mailto:")) {
      issues.push({ severity: "info", message: "No clickable email link found" });
    }

    // 5. Check CSS is present
    if (!site.css_output || site.css_output.length < 100) {
      issues.push({ severity: "error", message: "CSS is missing or very short" });
    }

    // 6. Check responsive CSS
    if (!site.css_output.includes("@media")) {
      issues.push({ severity: "warning", message: "No media queries — may not be responsive" });
    }

    // 7. Accessibility basics
    if (!htmlLower.includes("lang=")) {
      issues.push({ severity: "warning", message: "Missing lang attribute on <html> tag" });
    }

    // Compute score
    const errorCount = issues.filter((i) => i.severity === "error").length;
    const warningCount = issues.filter((i) => i.severity === "warning").length;
    let score = 100;
    score -= errorCount * 20;
    score -= warningCount * 5;
    score = Math.max(0, Math.min(100, score));

    const passed = errorCount === 0;

    results.push({
      lead_id: site.lead_id,
      site_name: site.site_name,
      domain: site.domain,
      passed,
      score,
      issues,
      error_count: errorCount,
      warning_count: warningCount,
      html_size: html.length,
      css_size: site.css_output.length,
    });
  }

  const passCount = results.filter((r) => r.passed).length;
  const avgScore = Math.round(
    results.reduce((sum, r) => sum + (r.score as number), 0) / results.length,
  );

  return {
    summary: `QA completed: ${passCount}/${results.length} passed (avg score: ${avgScore}).`,
    artifacts: {
      results,
      qa_count: results.length,
      pass_count: passCount,
      fail_count: results.length - passCount,
      avg_score: avgScore,
    },
  };
};
