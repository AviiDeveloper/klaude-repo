import { createLogger } from "../../lib/logger.js";
import { AgentHandler } from "../../pipeline/agentRuntime.js";
import type { VerticalCategory } from "./leadScoutAgent.js";

const log = createLogger("lead-qualifier");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LeadWithProfile {
  lead_id?: string;
  business_name: string;
  business_type?: string;
  vertical_category?: VerticalCategory;
  has_premises?: boolean;
  has_website: number;
  website_quality_score?: number | null;
  google_rating?: number | null;
  google_review_count?: number | null;
  has_social_links?: number;
  pain_points_json?: string;
  source?: string;
  address?: string;
  phone?: string;
  email?: string;
}

interface QualifiedLead extends LeadWithProfile {
  qualification_score: number;
  qualification_reasons: string[];
}

interface RejectedLead extends LeadWithProfile {
  rejection_reason: string;
}

// ---------------------------------------------------------------------------
// Vertical multipliers — walk-in-friendly businesses score higher
// ---------------------------------------------------------------------------

const VERTICAL_MULTIPLIERS: Record<string, number> = {
  food: 1.2,        // High walk-in traffic, visible premises
  beauty: 1.2,      // Appointment-based but has shopfront
  retail: 1.1,      // Shopfront, visible
  professional: 1.0, // Office, harder to walk into but possible
  trades: 0.3,      // Van-based, no premises — soft exclude
  unknown: 0.8,
};

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export const leadQualifierAgent: AgentHandler = async (input) => {
  const upstream = input.upstreamArtifacts as Record<
    string,
    { leads?: LeadWithProfile[]; profiles?: LeadWithProfile[]; intelligence?: Array<{ lead_id?: string }> }
  >;

  const allLeads: LeadWithProfile[] = [];
  const allProfiles = new Map<string, LeadWithProfile>();

  for (const nodeOutput of Object.values(upstream)) {
    if (nodeOutput?.leads) allLeads.push(...nodeOutput.leads);
    if (nodeOutput?.profiles) {
      for (const p of nodeOutput.profiles) {
        if (p.lead_id || p.business_name) {
          allProfiles.set(p.lead_id ?? p.business_name, p);
        }
      }
    }
  }

  const mergedLeads = allLeads.map((lead) => {
    const profile = allProfiles.get(lead.lead_id ?? lead.business_name);
    return profile ? { ...lead, ...profile } : lead;
  });

  const leadsToScore = mergedLeads.length > 0 ? mergedLeads : Array.from(allProfiles.values());

  const qualified: QualifiedLead[] = [];
  const rejected: RejectedLead[] = [];

  for (const lead of leadsToScore) {
    let score = 0;
    const reasons: string[] = [];
    const vertical = lead.vertical_category ?? "unknown";
    const multiplier = VERTICAL_MULTIPLIERS[vertical] ?? 0.8;

    // ── Website opportunity scoring ──
    if (!lead.has_website || lead.has_website === 0) {
      score += 40;
      reasons.push("No website — prime candidate");
    } else if (lead.website_quality_score != null && lead.website_quality_score < 40) {
      score += 30;
      reasons.push(`Poor website quality (score: ${lead.website_quality_score})`);
    } else if (lead.website_quality_score != null && lead.website_quality_score < 60) {
      score += 15;
      reasons.push(`Below-average website (score: ${lead.website_quality_score})`);
    } else if (lead.website_quality_score != null && lead.website_quality_score >= 70) {
      score -= 20;
      reasons.push(`Good existing website (score: ${lead.website_quality_score})`);
    }

    // ── Google presence ──
    if (lead.google_review_count != null) {
      if (lead.google_review_count >= 20) {
        score += 20;
        reasons.push(`Active on Google (${lead.google_review_count} reviews)`);
      } else if (lead.google_review_count >= 5) {
        score += 10;
        reasons.push(`Some Google presence (${lead.google_review_count} reviews)`);
      }
    }

    if (lead.google_rating != null && lead.google_rating >= 4.0) {
      score += 10;
      reasons.push(`Good reputation (${lead.google_rating} stars)`);
    }

    // ── Social presence ──
    if (lead.has_social_links) {
      score += 10;
      reasons.push("Active on social media");
    }

    // ── Contact info ──
    if (lead.phone || lead.email) {
      score += 10;
      reasons.push("Contact info available");
    }

    // ── Has physical premises (from Google types) ──
    if (lead.has_premises) {
      score += 15;
      reasons.push("Has physical premises (walk-in friendly)");
    }

    // ── Pain points ──
    if (lead.pain_points_json) {
      try {
        const painPoints = JSON.parse(lead.pain_points_json as string) as string[];
        if (painPoints.length >= 3) {
          score += 10;
          reasons.push(`${painPoints.length} identified pain points`);
        } else if (painPoints.length >= 1) {
          score += 5;
        }
      } catch { /* ignore */ }
    }

    // ── Apply vertical multiplier ──
    const rawScore = score;
    score = Math.round(score * multiplier);

    if (multiplier !== 1.0) {
      reasons.push(`Vertical: ${vertical} (${multiplier}x multiplier)`);
    }

    // ── Qualification threshold ──
    if (score >= 30) {
      qualified.push({
        ...lead,
        qualification_score: score,
        qualification_reasons: reasons,
      });
    } else {
      let reason: string;
      if (vertical === "trades") {
        reason = `Trades business — no walk-in premises (score ${rawScore} × ${multiplier} = ${score})`;
      } else if (score <= 0) {
        reason = "Already has a good website";
      } else {
        reason = `Score too low (${score}) — ${reasons.join("; ") || "insufficient signals"}`;
      }
      rejected.push({ ...lead, rejection_reason: reason });
    }
  }

  qualified.sort((a, b) => b.qualification_score - a.qualification_score);

  const tradeCount = leadsToScore.filter((l) => l.vertical_category === "trades").length;
  const tradeRejected = rejected.filter((l) => l.vertical_category === "trades").length;

  log.info("qualification complete", {
    total: leadsToScore.length,
    qualified: qualified.length,
    rejected: rejected.length,
    trades_filtered: tradeRejected,
  });

  return {
    summary: `Qualified ${qualified.length}/${leadsToScore.length} leads. Top score: ${qualified[0]?.qualification_score ?? 0}. Rejected: ${rejected.length} (${tradeRejected} trades).`,
    artifacts: {
      qualified,
      rejected,
      qualified_count: qualified.length,
      rejected_count: rejected.length,
      avg_score: qualified.length > 0
        ? Math.round(qualified.reduce((sum, l) => sum + l.qualification_score, 0) / qualified.length)
        : 0,
      _decision: {
        reasoning: `Scored ${leadsToScore.length} leads. ${qualified.length} qualified (threshold ≥30). ${tradeRejected}/${tradeCount} trades soft-excluded (0.3x multiplier). Top verticals: ${[...new Set(qualified.map((q) => q.vertical_category))].join(", ")}`,
        alternatives: ["Could adjust multipliers based on close rate data", "Could add location-density scoring"],
        confidence: qualified.length > 0 ? 0.8 : 0.4,
        tags: [`qualified:${qualified.length}`, `rejected:${rejected.length}`],
      },
    },
  };
};
