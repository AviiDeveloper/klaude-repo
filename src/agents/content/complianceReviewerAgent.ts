import { createLogger } from "../../lib/logger.js";
import { AgentHandler } from "../../pipeline/agentRuntime.js";

const log = createLogger("compliance-reviewer");

interface ComplianceIssue {
  severity: "error" | "warning" | "info";
  category: string;
  message: string;
  location: string;
}

interface ComplianceResult {
  script_index: number;
  topic: string;
  platform: string;
  passed: boolean;
  score: number;
  issues: ComplianceIssue[];
}

// No AI needed — pure rule-based compliance checking
const PROHIBITED_PATTERNS = [
  { pattern: /guarante(?:e|ed|s)\s+(?:results|income|money|profit)/i, category: "claims", message: "Cannot guarantee financial results" },
  { pattern: /(?:get rich|make money fast|passive income|financial freedom)\s+(?:quick|fast|easy)/i, category: "claims", message: "Get-rich-quick claims prohibited" },
  { pattern: /(?:fuck|shit|damn|ass|bitch|crap)/i, category: "language", message: "Profanity not allowed in business content" },
  { pattern: /(?:kill|murder|destroy|annihilate)\s+(?:your|the)\s+(?:competition|competitors)/i, category: "language", message: "Violent competitive language prohibited" },
  { pattern: /(?:before|after)\s+(?:photos?|pictures?|images?).*(?:weight|body|face)/i, category: "claims", message: "Before/after health claims require disclaimers" },
  { pattern: /(?:cure|treat|heal|fix)\s+(?:disease|illness|condition|anxiety|depression)/i, category: "health", message: "Medical claims not permitted" },
  { pattern: /(?:100%|always|never fails|works every time)/i, category: "claims", message: "Absolute claims need hedging" },
  { pattern: /(?:buy now|limited time|act fast|don't miss out|last chance)/i, category: "urgency", message: "High-pressure urgency language — review for platform compliance" },
];

const REQUIRED_CHECKS = [
  { check: (text: string) => text.length >= 20, message: "Content too short to be useful" },
  { check: (text: string) => text.length <= 5000, message: "Content exceeds recommended length" },
  { check: (_text: string, hashtags?: string[]) => !hashtags || hashtags.length <= 30, message: "Too many hashtags (max 30)" },
];

const PLATFORM_RULES: Record<string, Array<{ check: (text: string) => boolean; message: string }>> = {
  tiktok: [
    { check: (text) => !text.includes("swipe up"), message: "TikTok doesn't support 'swipe up' CTA" },
  ],
  reels: [
    { check: (text) => !text.toLowerCase().includes("tiktok"), message: "Don't mention TikTok on Reels" },
  ],
  shorts: [
    { check: (text) => !text.toLowerCase().includes("tiktok"), message: "Don't mention TikTok on Shorts" },
  ],
};

function getMostCommonIssue(results: ComplianceResult[]): string {
  const counts = new Map<string, number>();
  for (const r of results) {
    for (const issue of r.issues) {
      counts.set(issue.category, (counts.get(issue.category) ?? 0) + 1);
    }
  }
  let max = 0;
  let maxCat = "none";
  for (const [cat, count] of counts) {
    if (count > max) { max = count; maxCat = cat; }
  }
  return maxCat;
}

export const complianceReviewerAgent: AgentHandler = async (input) => {
  const scripts = (input.upstreamArtifacts?.scripts as Array<{
    topic: string;
    platform: string;
    hook: string;
    body: string[];
    cta: string;
    hashtags?: string[];
  }>) ?? [];

  if (scripts.length === 0) {
    return {
      summary: "No scripts to review",
      artifacts: { results: [], compliance_passed: true },
    };
  }

  const results: ComplianceResult[] = [];

  for (let i = 0; i < scripts.length; i++) {
    const script = scripts[i];
    const fullText = [script.hook, ...(script.body ?? []), script.cta].join(" ");
    const issues: ComplianceIssue[] = [];

    // Check prohibited patterns
    for (const rule of PROHIBITED_PATTERNS) {
      if (rule.pattern.test(fullText)) {
        issues.push({
          severity: rule.category === "claims" || rule.category === "health" ? "error" : "warning",
          category: rule.category,
          message: rule.message,
          location: `script[${i}]`,
        });
      }
    }

    // Required checks
    for (const req of REQUIRED_CHECKS) {
      if (!req.check(fullText, script.hashtags)) {
        issues.push({
          severity: "warning",
          category: "format",
          message: req.message,
          location: `script[${i}]`,
        });
      }
    }

    // Platform-specific checks
    const platformRules = PLATFORM_RULES[script.platform] ?? [];
    for (const rule of platformRules) {
      if (!rule.check(fullText)) {
        issues.push({
          severity: "warning",
          category: "platform",
          message: rule.message,
          location: `script[${i}].${script.platform}`,
        });
      }
    }

    const errorCount = issues.filter((i) => i.severity === "error").length;
    const score = Math.max(0, 100 - errorCount * 25 - (issues.length - errorCount) * 5);

    results.push({
      script_index: i,
      topic: script.topic,
      platform: script.platform,
      passed: errorCount === 0,
      score,
      issues,
    });
  }

  const passedCount = results.filter((r) => r.passed).length;
  const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0);

  log.info(`compliance review: ${passedCount}/${results.length} passed, ${totalIssues} issues found`);

  return {
    summary: `Compliance review: ${passedCount}/${results.length} scripts passed. ${totalIssues} issues found.`,
    artifacts: {
      results,
      compliance_passed: passedCount === results.length,
      passed_count: passedCount,
      failed_count: results.length - passedCount,
      total_issues: totalIssues,
      scripts: scripts.filter((_, i) => results[i]?.passed),
      _decision: {
        reasoning: `Rule-based compliance check: ${passedCount}/${results.length} passed. ${totalIssues} issues across categories: ${[...new Set(results.flatMap((r) => r.issues.map((i) => i.category)))].join(", ") || "none"}. Most common: ${getMostCommonIssue(results)}.`,
        alternatives: ["Could add AI-based tone analysis", "Could check against platform-specific TOS"],
        confidence: 0.9, // Rule-based = high confidence
        tags: ["compliance", `pass_rate:${(passedCount / Math.max(results.length, 1) * 100).toFixed(0)}pct`],
      },
    },
  };
};
