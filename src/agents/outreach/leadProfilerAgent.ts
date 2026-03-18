import { AgentHandler } from "../../pipeline/agentRuntime.js";

export interface LeadToProfile {
  lead_id?: string;
  business_name: string;
  website_url?: string | null;
  google_maps_url?: string | null;
  google_rating?: number;
  google_review_count?: number;
}

export const leadProfilerAgent: AgentHandler = async (input) => {
  const upstream = input.upstreamArtifacts as Record<string, { leads?: LeadToProfile[] }>;
  const leads: LeadToProfile[] = [];

  // Collect leads from all upstream nodes
  for (const nodeOutput of Object.values(upstream)) {
    if (nodeOutput?.leads) {
      leads.push(...nodeOutput.leads);
    }
  }

  if (leads.length === 0) {
    return {
      summary: "No leads to profile.",
      artifacts: { profiles: [], profiled_count: 0 },
    };
  }

  const profiles: Array<Record<string, unknown>> = [];

  for (const lead of leads) {
    const profile: Record<string, unknown> = {
      lead_id: lead.lead_id,
      business_name: lead.business_name,
      google_rating: lead.google_rating ?? null,
      google_review_count: lead.google_review_count ?? null,
    };

    if (lead.website_url) {
      // Attempt basic website analysis via fetch
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const response = await fetch(lead.website_url, {
          signal: controller.signal,
          redirect: "follow",
        });
        clearTimeout(timeout);

        const html = await response.text();
        const htmlLower = html.toLowerCase();

        profile.has_ssl = lead.website_url.startsWith("https://") ? 1 : 0;
        profile.is_mobile_friendly = htmlLower.includes("viewport") ? 1 : 0;
        profile.has_social_links =
          htmlLower.includes("facebook.com") ||
          htmlLower.includes("instagram.com") ||
          htmlLower.includes("twitter.com") ||
          htmlLower.includes("linkedin.com")
            ? 1
            : 0;

        // Extract social links
        const socialLinks: string[] = [];
        const socialPatterns = [
          /https?:\/\/(?:www\.)?facebook\.com\/[^\s"'<>]+/gi,
          /https?:\/\/(?:www\.)?instagram\.com\/[^\s"'<>]+/gi,
          /https?:\/\/(?:www\.)?twitter\.com\/[^\s"'<>]+/gi,
          /https?:\/\/(?:www\.)?linkedin\.com\/[^\s"'<>]+/gi,
        ];
        for (const pattern of socialPatterns) {
          const matches = html.match(pattern);
          if (matches) socialLinks.push(...matches.slice(0, 2));
        }
        profile.social_links_json = JSON.stringify(socialLinks);

        // Basic tech stack detection
        const techStack: string[] = [];
        if (htmlLower.includes("wordpress")) techStack.push("WordPress");
        if (htmlLower.includes("wix.com")) techStack.push("Wix");
        if (htmlLower.includes("squarespace")) techStack.push("Squarespace");
        if (htmlLower.includes("shopify")) techStack.push("Shopify");
        if (htmlLower.includes("react")) techStack.push("React");
        if (htmlLower.includes("bootstrap")) techStack.push("Bootstrap");
        if (techStack.length === 0) techStack.push("Unknown/Custom");
        profile.website_tech_stack = JSON.stringify(techStack);

        // Rough quality score based on basic signals
        let qualityScore = 50;
        if (profile.has_ssl) qualityScore += 10;
        if (profile.is_mobile_friendly) qualityScore += 15;
        if (profile.has_social_links) qualityScore += 10;
        if (response.status === 200) qualityScore += 15;
        profile.website_quality_score = Math.min(qualityScore, 100);

        // Infer pain points
        const painPoints: string[] = [];
        if (!profile.has_ssl) painPoints.push("No SSL certificate — looks unprofessional and hurts SEO");
        if (!profile.is_mobile_friendly) painPoints.push("Not mobile-friendly — losing mobile customers");
        if (!profile.has_social_links) painPoints.push("No social media integration");
        if (html.length < 5000) painPoints.push("Very thin content — may not rank well in search");
        if (techStack.includes("WordPress") && htmlLower.includes("theme")) {
          painPoints.push("Generic WordPress theme — looks like many other sites");
        }
        profile.pain_points_json = JSON.stringify(painPoints);
      } catch {
        profile.website_quality_score = 0;
        profile.pain_points_json = JSON.stringify(["Website unreachable or very slow"]);
      }
    } else {
      // No website at all — highest opportunity
      profile.has_ssl = 0;
      profile.is_mobile_friendly = 0;
      profile.website_quality_score = 0;
      profile.pain_points_json = JSON.stringify([
        "No website at all — missing out on online customers",
        "No online presence beyond social media or directory listings",
        "Competitors with websites are capturing their potential customers",
      ]);
    }

    profile.profiled_at = new Date().toISOString();
    profiles.push(profile);
  }

  return {
    summary: `Profiled ${profiles.length} leads. ${profiles.filter((p) => !p.website_quality_score || (p.website_quality_score as number) < 40).length} have poor/no websites.`,
    artifacts: {
      profiles,
      profiled_count: profiles.length,
      high_opportunity_count: profiles.filter(
        (p) => !p.website_quality_score || (p.website_quality_score as number) < 40,
      ).length,
    },
  };
};
