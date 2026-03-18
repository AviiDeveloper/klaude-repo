import { AgentHandler } from "../../pipeline/agentRuntime.js";
import { siteTemplates, verticalDefaults, resolveVertical } from "../../templates/siteTemplates.js";

interface LeadData {
  lead_id?: string;
  business_name: string;
  business_type?: string;
  phone?: string;
  email?: string;
  address?: string;
  google_rating?: number;
  google_review_count?: number;
  qualification_score?: number;
  pain_points_json?: string;
}

/**
 * Generates a landing page by filling a template with lead-specific content.
 *
 * In production this would call an LLM to generate marketing copy.
 * For now it uses deterministic content generation based on lead data.
 */
export const siteComposerAgent: AgentHandler = async (input) => {
  const upstream = input.upstreamArtifacts as Record<string, { qualified?: LeadData[]; leads?: LeadData[] }>;

  // Collect leads from upstream (qualifier output or direct leads)
  const leads: LeadData[] = [];
  for (const nodeOutput of Object.values(upstream)) {
    if (nodeOutput?.qualified) leads.push(...nodeOutput.qualified);
    else if (nodeOutput?.leads) leads.push(...nodeOutput.leads);
  }

  // Config can override which leads to process
  const config = (input.config ?? {}) as { lead_ids?: string[]; template_id?: string; max_sites?: number };
  const maxSites = config.max_sites ?? 10;
  const targetLeads = config.lead_ids
    ? leads.filter((l) => config.lead_ids!.includes(l.lead_id ?? ""))
    : leads.slice(0, maxSites);

  if (targetLeads.length === 0) {
    return {
      summary: "No qualified leads to generate sites for.",
      artifacts: { sites: [], generated_count: 0 },
    };
  }

  const generatedSites: Array<Record<string, unknown>> = [];

  for (const lead of targetLeads) {
    const vertical = resolveVertical(lead.business_type ?? "general");
    const templateId = config.template_id ?? `${vertical}-v1`;
    const template = siteTemplates.find((t) => t.id === templateId) ?? siteTemplates[0];
    const defaults = verticalDefaults[vertical] ?? verticalDefaults.general;

    const businessName = lead.business_name;
    const businessType = lead.business_type ?? "business";
    const phone = lead.phone ?? "01onal 000 0000";
    const email = lead.email ?? `info@${businessName.toLowerCase().replace(/\s+/g, "")}.co.uk`;
    const address = lead.address ?? "";

    // Generate content (deterministic for now — LLM integration in production)
    const tagline = generateTagline(businessName, businessType, vertical);
    const heroDescription = generateHeroDescription(businessName, businessType, lead);
    const aboutText = generateAboutText(businessName, businessType, lead);
    const servicesHtml = generateServicesHtml(businessType, vertical);
    const ctaHeading = `Ready to Get Started?`;
    const ctaSubtext = `Contact ${businessName} today — we'd love to hear from you.`;

    const templateVars: Record<string, string> = {
      business_name: businessName,
      tagline,
      phone,
      email,
      address,
      hero_description: heroDescription,
      about_text: aboutText,
      services_html: servicesHtml,
      cta_text: defaults.cta_text,
      cta_heading: ctaHeading,
      cta_subtext: ctaSubtext,
      primary_color: defaults.primary_color,
      accent_color: defaults.accent_color,
      year: new Date().getFullYear().toString(),
    };

    // Fill template
    let css = template.css_template;
    let html = template.html_template;

    // Replace CSS vars first, then inject CSS into HTML
    for (const [key, value] of Object.entries(templateVars)) {
      css = css.replaceAll(`{{${key}}}`, value);
    }
    templateVars.css = css;

    for (const [key, value] of Object.entries(templateVars)) {
      html = html.replaceAll(`{{${key}}}`, value);
    }

    const siteName = `${businessName} — ${businessType.charAt(0).toUpperCase() + businessType.slice(1)}`;
    const domain = `${businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;

    generatedSites.push({
      lead_id: lead.lead_id,
      template_id: template.id,
      site_name: siteName,
      domain,
      config_json: JSON.stringify(templateVars),
      html_output: html,
      css_output: css,
      business_name: businessName,
      vertical,
    });
  }

  return {
    summary: `Generated ${generatedSites.length} landing pages across ${new Set(generatedSites.map((s) => s.vertical)).size} verticals.`,
    artifacts: {
      sites: generatedSites,
      generated_count: generatedSites.length,
    },
  };
};

function generateTagline(name: string, type: string, vertical: string): string {
  const taglines: Record<string, string[]> = {
    trades: [
      `Your Trusted Local ${capitalize(type)}`,
      `${capitalize(type)} Services You Can Rely On`,
      `Professional ${capitalize(type)} — Done Right`,
    ],
    food: [
      `Fresh, Delicious Food at ${name}`,
      `Welcome to ${name}`,
      `Great Food, Great Atmosphere`,
    ],
    health: [
      `Your Wellbeing, Our Priority`,
      `Professional ${capitalize(type)} Services`,
      `Look Good, Feel Great at ${name}`,
    ],
    professional: [
      `Expert ${capitalize(type)} Services`,
      `Trusted ${capitalize(type)} for Your Needs`,
      `Professional. Reliable. ${name}.`,
    ],
    retail: [
      `Welcome to ${name}`,
      `Quality Products, Friendly Service`,
      `Your Local ${capitalize(type)}`,
    ],
  };
  const options = taglines[vertical] ?? taglines.trades;
  return options[hashString(name) % options.length];
}

function generateHeroDescription(name: string, type: string, lead: LeadData): string {
  const ratingText = lead.google_rating
    ? ` Rated ${lead.google_rating} stars by ${lead.google_review_count ?? "our"} happy customers.`
    : "";
  return `${name} provides reliable, professional ${type} services in your area.${ratingText} Get in touch today for a no-obligation quote.`;
}

function generateAboutText(name: string, type: string, lead: LeadData): string {
  const reviewMention = lead.google_review_count && lead.google_review_count > 10
    ? ` With over ${lead.google_review_count} positive reviews, we've built a reputation for quality and reliability.`
    : "";
  return `${name} is a trusted local ${type} dedicated to delivering excellent service every time. We take pride in our work and treat every job with the care and attention it deserves.${reviewMention} Contact us today to see how we can help.`;
}

function generateServicesHtml(type: string, vertical: string): string {
  const servicesByVertical: Record<string, string[]> = {
    trades: ["Emergency Repairs", "Installation", "Maintenance", "Free Quotes"],
    food: ["Dine In", "Takeaway", "Catering", "Private Events"],
    health: ["Consultations", "Treatments", "Wellness Plans", "Walk-Ins Welcome"],
    professional: ["Initial Consultation", "Ongoing Support", "Specialist Advice", "Flexible Plans"],
    retail: ["In-Store Shopping", "Click & Collect", "Special Orders", "Gift Cards"],
  };
  const services = servicesByVertical[vertical] ?? servicesByVertical.trades;
  return services
    .map(
      (s) =>
        `<div class="service-card"><h3>${s}</h3><p>Professional ${type} ${s.toLowerCase()} tailored to your needs.</p></div>`,
    )
    .join("\n        ");
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}
