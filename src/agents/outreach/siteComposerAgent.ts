import { AgentHandler } from "../../pipeline/agentRuntime.js";
import { siteTemplates, verticalDefaults, resolveVertical, processConditionals } from "../../templates/siteTemplates.js";
import { buildAssetUrl } from "../../lib/assetStore.js";
import type { BrandAnalysis, PhotoInventoryItem } from "./brandAnalyser.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

interface UpstreamData {
  qualified?: LeadData[];
  leads?: LeadData[];
  analyses?: BrandAnalysis[];
  profiles?: Array<LeadData & { brand_colours_json?: string }>;
}

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

/**
 * Generates a landing page by filling a template with lead-specific content.
 * When brand analysis data is available from upstream, uses real colours,
 * logos, photos, descriptions, and services instead of defaults.
 */
export const siteComposerAgent: AgentHandler = async (input) => {
  const upstream = input.upstreamArtifacts as Record<string, UpstreamData>;

  // Collect leads and brand analyses from upstream
  const leads: LeadData[] = [];
  const brandAnalyses = new Map<string, BrandAnalysis>();

  for (const nodeOutput of Object.values(upstream)) {
    if (nodeOutput?.qualified) leads.push(...nodeOutput.qualified);
    else if (nodeOutput?.leads) leads.push(...nodeOutput.leads);

    if (nodeOutput?.analyses) {
      for (const analysis of nodeOutput.analyses) {
        brandAnalyses.set(analysis.lead_id, analysis);
      }
    }
  }

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
    const leadId = lead.lead_id ?? "";
    const vertical = resolveVertical(lead.business_type ?? "general");
    const templateId = config.template_id ?? `${vertical}-v1`;
    const template = siteTemplates.find((t) => t.id === templateId) ?? siteTemplates[0];
    const defaults = verticalDefaults[vertical] ?? verticalDefaults.general;

    // Get brand analysis if available
    const brand = brandAnalyses.get(leadId);

    const businessName = lead.business_name;
    const businessType = lead.business_type ?? "business";
    const phone = lead.phone ?? "01onal 000 0000";
    const email = lead.email ?? `info@${businessName.toLowerCase().replace(/\s+/g, "")}.co.uk`;
    const address = lead.address ?? "";

    // --- Colours: prefer brand analysis over defaults ---
    const primaryColor = brand?.colours?.primary ?? defaults.primary_color;
    const accentColor = brand?.colours?.secondary ?? defaults.accent_color;

    // --- Fonts: prefer brand analysis over defaults ---
    const headingFont = brand?.fonts?.heading ?? defaults.heading_font;
    const bodyFont = brand?.fonts?.body ?? defaults.body_font;

    // --- Content: prefer brand analysis over generated ---
    const tagline = generateTagline(businessName, businessType, vertical);
    const heroDescription = brand?.description
      ? brand.description.slice(0, 200)
      : generateHeroDescription(businessName, businessType, lead);
    const aboutText = brand?.description
      ? brand.description
      : generateAboutText(businessName, businessType, lead);
    const servicesHtml = brand?.services && brand.services.length > 0
      ? brand.services.map((s) => `<div class="service-card"><h3>${escapeHtml(s)}</h3><p>Professional service tailored to your needs.</p></div>`).join("\n        ")
      : generateServicesHtml(businessType, vertical);

    // --- Logo ---
    const hasLogo = !!(brand?.logo_path && leadId);
    const logoUrl = hasLogo ? buildAssetUrl(leadId, brand!.logo_path!) : "";

    // --- Hero image ---
    const heroPhoto = brand?.photo_inventory?.find((p) => p.usable_for.includes("hero"));
    const hasHeroImage = !!(heroPhoto && leadId);
    const heroImageUrl = hasHeroImage ? buildAssetUrl(leadId, heroPhoto!.filename) : "";

    // --- Gallery ---
    const galleryPhotos = brand?.photo_inventory?.filter(
      (p) => p.usable_for.includes("gallery") && p.filename !== heroPhoto?.filename,
    ) ?? [];
    const hasGallery = galleryPhotos.length >= 2;
    const galleryHtml = hasGallery
      ? galleryPhotos.slice(0, 6).map((p) =>
          `<img src="${buildAssetUrl(leadId, p.filename)}" alt="${escapeHtml(businessName)}" loading="lazy">`
        ).join("\n        ")
      : "";

    // --- Menu (food vertical) ---
    const hasMenu = !!(brand?.menu_items && brand.menu_items.length > 0);
    const menuHtml = hasMenu
      ? brand!.menu_items!.map((item) =>
          `<div class="menu-item"><span class="menu-item-name">${escapeHtml(item.name)}</span>${item.price ? `<span class="menu-item-price">${escapeHtml(item.price)}</span>` : ""}</div>`
        ).join("\n        ")
      : "";

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
      cta_heading: "Ready to Get Started?",
      cta_subtext: `Contact ${businessName} today — we'd love to hear from you.`,
      primary_color: primaryColor,
      accent_color: accentColor,
      heading_font: headingFont,
      body_font: bodyFont,
      year: new Date().getFullYear().toString(),
      // Image/conditional vars
      logo_url: logoUrl,
      hero_image_url: heroImageUrl,
      gallery_html: galleryHtml,
      menu_html: menuHtml,
      // Conditional flags
      has_logo: hasLogo ? "true" : "",
      has_hero_image: hasHeroImage ? "true" : "",
      no_hero_image: hasHeroImage ? "" : "true",
      has_gallery: hasGallery ? "true" : "",
      has_menu: hasMenu ? "true" : "",
    };

    // Fill template: CSS first, then inject into HTML
    let css = template.css_template;
    let html = template.html_template;

    for (const [key, value] of Object.entries(templateVars)) {
      css = css.replaceAll(`{{${key}}}`, value);
    }
    templateVars.css = css;

    for (const [key, value] of Object.entries(templateVars)) {
      html = html.replaceAll(`{{${key}}}`, value);
    }

    // Process conditional blocks
    html = processConditionals(html, templateVars);

    const siteName = `${businessName} — ${businessType.charAt(0).toUpperCase() + businessType.slice(1)}`;
    const domain = `${businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;

    // Track which assets were used
    const assetsUsed: string[] = [];
    if (hasLogo) assetsUsed.push(brand!.logo_path!);
    if (hasHeroImage) assetsUsed.push(heroPhoto!.filename);
    galleryPhotos.slice(0, 6).forEach((p) => assetsUsed.push(p.filename));

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
      assets_used_json: JSON.stringify(assetsUsed),
      brand_source: brand?.colours?.palette_source ?? "vertical_default",
    });
  }

  const withBrand = generatedSites.filter((s) => s.brand_source !== "vertical_default").length;

  return {
    summary: `Generated ${generatedSites.length} landing pages. ${withBrand} with real brand data, ${generatedSites.length - withBrand} with defaults.`,
    artifacts: {
      sites: generatedSites,
      generated_count: generatedSites.length,
    },
  };
};

// ---------------------------------------------------------------------------
// Content generation helpers
// ---------------------------------------------------------------------------

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
    .map((s) => `<div class="service-card"><h3>${s}</h3><p>Professional ${type} ${s.toLowerCase()} tailored to your needs.</p></div>`)
    .join("\n        ");
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

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

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
