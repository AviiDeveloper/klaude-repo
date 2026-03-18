import { AgentHandler } from "../../pipeline/agentRuntime.js";

interface LeadWithProfile {
  lead_id?: string;
  business_name: string;
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

export const leadQualifierAgent: AgentHandler = async (input) => {
  const upstream = input.upstreamArtifacts as Record<
    string,
    { leads?: LeadWithProfile[]; profiles?: LeadWithProfile[] }
  >;

  // Merge leads and profiles from upstream
  const allLeads: LeadWithProfile[] = [];
  const allProfiles: Map<string, LeadWithProfile> = new Map();

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

  // Merge profile data into leads
  const mergedLeads = allLeads.map((lead) => {
    const profile = allProfiles.get(lead.lead_id ?? lead.business_name);
    return profile ? { ...lead, ...profile } : lead;
  });

  // If no leads from upstream, check profiles directly
  const leadsToScore = mergedLeads.length > 0 ? mergedLeads : Array.from(allProfiles.values());

  const qualified: QualifiedLead[] = [];
  const rejected: RejectedLead[] = [];

  for (const lead of leadsToScore) {
    let score = 0;
    const reasons: string[] = [];

    // No website = highest opportunity (40 pts)
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
      // Good website — probably not a good target
      score -= 20;
      reasons.push(`Good existing website (score: ${lead.website_quality_score})`);
    }

    // Google reviews signal an active business (up to 20 pts)
    if (lead.google_review_count != null) {
      if (lead.google_review_count >= 20) {
        score += 20;
        reasons.push(`Active on Google (${lead.google_review_count} reviews)`);
      } else if (lead.google_review_count >= 5) {
        score += 10;
        reasons.push(`Some Google presence (${lead.google_review_count} reviews)`);
      }
    }

    // Good Google rating means established business (up to 10 pts)
    if (lead.google_rating != null && lead.google_rating >= 4.0) {
      score += 10;
      reasons.push(`Good reputation (${lead.google_rating} stars)`);
    }

    // Has social presence means they care about marketing (10 pts)
    if (lead.has_social_links) {
      score += 10;
      reasons.push("Active on social media — marketing-aware");
    }

    // Has contact info (10 pts)
    if (lead.phone || lead.email) {
      score += 10;
      reasons.push("Contact info available");
    }

    // Multiple pain points increase opportunity (up to 10 pts)
    if (lead.pain_points_json) {
      try {
        const painPoints = JSON.parse(lead.pain_points_json as string) as string[];
        if (painPoints.length >= 3) {
          score += 10;
          reasons.push(`${painPoints.length} identified pain points`);
        } else if (painPoints.length >= 1) {
          score += 5;
        }
      } catch {
        // ignore parse errors
      }
    }

    // Qualification threshold
    if (score >= 30) {
      qualified.push({
        ...lead,
        qualification_score: score,
        qualification_reasons: reasons,
      });
    } else {
      rejected.push({
        ...lead,
        rejection_reason:
          score <= 0
            ? "Already has a good website"
            : `Score too low (${score}) — ${reasons.join("; ") || "insufficient signals"}`,
      });
    }
  }

  // Sort qualified leads by score descending
  qualified.sort((a, b) => b.qualification_score - a.qualification_score);

  return {
    summary: `Qualified ${qualified.length}/${leadsToScore.length} leads. Top score: ${qualified[0]?.qualification_score ?? 0}. Rejected: ${rejected.length}.`,
    artifacts: {
      qualified,
      rejected,
      qualified_count: qualified.length,
      rejected_count: rejected.length,
      avg_score: qualified.length > 0
        ? Math.round(qualified.reduce((sum, l) => sum + l.qualification_score, 0) / qualified.length)
        : 0,
    },
  };
};
