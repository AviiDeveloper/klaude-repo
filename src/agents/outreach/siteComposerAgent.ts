import { AgentHandler } from "../../pipeline/agentRuntime.js";
import { siteTemplates, resolveVertical, processConditionals } from "../../templates/siteTemplates.js";
import { buildAssetUrl } from "../../lib/assetStore.js";
import { makeDesignDecision, generateCss, type DesignInput } from "./designSystem.js";
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
  // New fields from upgraded profiler
  reviews_json?: string;
  opening_hours_json?: string;
  maps_embed_url?: string;
  lat?: number;
  lng?: number;
  social_profiles_json?: string;
  business_description_raw?: string;
}

interface GoogleReview {
  author: string;
  rating: number;
  text: string;
  relative_time?: string;
}

interface UpstreamData {
  qualified?: LeadData[];
  leads?: LeadData[];
  analyses?: BrandAnalysis[];
  profiles?: LeadData[];
}

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export const siteComposerAgent: AgentHandler = async (input) => {
  const upstream = input.upstreamArtifacts as Record<string, UpstreamData>;

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

    const brand = brandAnalyses.get(leadId);

    const businessName = lead.business_name;
    const businessType = lead.business_type ?? "business";
    const phone = lead.phone ?? "";
    const email = lead.email ?? `info@${businessName.toLowerCase().replace(/[^a-z0-9]+/g, "")}.co.uk`;
    const address = lead.address ?? "";

    // --- Gather asset availability ---
    const heroPhoto = brand?.photo_inventory?.find((p) => p.usable_for.includes("hero"));
    const hasHeroImage = !!(heroPhoto && leadId);
    const galleryPhotos = brand?.photo_inventory?.filter(
      (p) => p.usable_for.includes("gallery") && p.filename !== heroPhoto?.filename,
    ) ?? [];
    const socialPhotos = brand?.photo_inventory?.filter((p) => p.category === "social") ?? [];
    const hasGallery = galleryPhotos.length >= 2;
    const hasLogo = !!(brand?.logo_path && leadId);
    const reviews = safeJsonParse<GoogleReview[]>(lead.reviews_json, []);
    const goodReviews = reviews.filter((r) => r.rating >= 4 && r.text.length > 20);
    const hasReviews = goodReviews.length > 0;
    const hours = safeJsonParse<string[]>(lead.opening_hours_json, []);
    const hasHours = hours.length > 0;
    const hasMap = !!(lead.maps_embed_url);
    const hasMenu = !!(brand?.menu_items && brand.menu_items.length > 0);

    // --- DESIGN SYSTEM: consult the design brain ---
    const designInput: DesignInput = {
      vertical,
      businessName,
      businessType,
      scrapedPrimary: brand?.colours?.primary,
      scrapedSecondary: brand?.colours?.secondary,
      scrapedAccent: brand?.colours?.accent,
      scrapedFonts: brand?.fonts ? [brand.fonts.heading, brand.fonts.body].filter(Boolean) : undefined,
      paletteSource: brand?.colours?.palette_source,
      hasLogo,
      hasHeroImage,
      hasGallery,
      galleryCount: galleryPhotos.length + socialPhotos.length,
      hasReviews,
      reviewCount: goodReviews.length,
      hasHours,
      hasMap,
      hasMenu,
      hasSocialImages: socialPhotos.length > 0,
      socialImageCount: socialPhotos.length,
      googleRating: lead.google_rating ?? undefined,
      googleReviewCount: lead.google_review_count ?? undefined,
    };

    const design = makeDesignDecision(designInput);
    const designCss = generateCss(design);

    // --- Content ---
    const tagline = generateTagline(businessName, businessType, vertical);
    const heroDescription = brand?.description
      ? smartTruncate(brand.description, 180)
      : generateHeroDescription(businessName, businessType, lead);
    const aboutText = brand?.description
      ? brand.description
      : generateAboutText(businessName, businessType, lead);
    const servicesSubtitle = `Professional ${businessType} services tailored to your needs`;

    // --- Services HTML ---
    const servicesHtml = brand?.services && brand.services.length > 0
      ? brand.services.slice(0, 6).map((s) =>
          `<div class="service-card"><h3>${escapeHtml(s)}</h3><p>${generateServiceDesc(s, businessType)}</p></div>`
        ).join("\n        ")
      : generateServicesHtml(businessType, vertical);

    const logoUrl = hasLogo ? buildAssetUrl(leadId, brand!.logo_path!) : "";
    const heroImageUrl = hasHeroImage ? buildAssetUrl(leadId, heroPhoto!.filename) : "";

    const galleryHtml = hasGallery
      ? galleryPhotos.slice(0, 8).map((p) =>
          `<div class="gallery-item"><img src="${buildAssetUrl(leadId, p.filename)}" alt="${escapeHtml(businessName)}" loading="lazy"></div>`
        ).join("\n        ")
      : "";

    const reviewsHtml = goodReviews.slice(0, 3).map((r) => `
        <div class="testimonial-card">
          <p class="testimonial-text">${escapeHtml(smartTruncate(r.text, 200))}</p>
          <p class="testimonial-author">${escapeHtml(r.author)}</p>
          <p class="testimonial-rating">${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</p>
        </div>`).join("\n");

    const hasRating = !!(lead.google_rating && lead.google_review_count && lead.google_review_count > 3);
    const starsHtml = hasRating
      ? "★".repeat(Math.round(lead.google_rating!)) + "☆".repeat(5 - Math.round(lead.google_rating!))
      : "";

    const hoursHtml = hours.slice(0, 7).map((h) => {
      const parts = h.match(/^(\w+(?:day)?)\s*[:\s]\s*(.+)$/i);
      if (parts) {
        return `<div class="hours-row"><span class="hours-day">${escapeHtml(parts[1])}</span><span class="hours-time">${escapeHtml(parts[2])}</span></div>`;
      }
      return `<div class="hours-row"><span class="hours-time">${escapeHtml(h)}</span></div>`;
    }).join("\n        ");

    const mapsEmbedUrl = lead.maps_embed_url ?? "";

    const menuHtml = hasMenu
      ? brand!.menu_items!.slice(0, 20).map((item) =>
          `<div class="menu-item"><span class="menu-item-name">${escapeHtml(item.name)}</span>${item.price ? `<span class="menu-item-price">${escapeHtml(item.price)}</span>` : ""}${item.description ? `<br><span class="menu-item-desc">${escapeHtml(item.description)}</span>` : ""}</div>`
        ).join("\n        ")
      : "";

    const ctaHeading = generateCtaHeading(businessName, vertical);
    const ctaSubtext = generateCtaSubtext(businessName, businessType, vertical);

    // --- CTA text from design system vertical defaults ---
    const ctaTextMap: Record<string, string> = {
      trades: "Call Now — Free Quote", food: "Book A Table", health: "Book An Appointment",
      professional: "Get In Touch", retail: "Visit Us Today",
    };

    const templateVars: Record<string, string> = {
      business_name: businessName,
      tagline,
      phone,
      email,
      address,
      hero_description: heroDescription,
      about_text: aboutText,
      services_html: servicesHtml,
      services_subtitle: `Professional ${businessType} services tailored to your needs`,
      cta_text: ctaTextMap[vertical] ?? "Contact Us",
      cta_heading: ctaHeading,
      cta_subtext: ctaSubtext,
      // Design system colours (for any remaining template placeholders)
      primary_color: design.colours.primary,
      accent_color: design.colours.secondary,
      heading_font: design.fonts.heading,
      heading_font_import: design.fonts.headingImport,
      body_font: design.fonts.body,
      body_font_import: design.fonts.bodyImport,
      year: new Date().getFullYear().toString(),
      // Data-driven sections
      logo_url: logoUrl,
      hero_image_url: heroImageUrl,
      gallery_html: galleryHtml,
      menu_html: menuHtml,
      reviews_html: reviewsHtml,
      hours_html: hoursHtml,
      maps_embed_url: mapsEmbedUrl,
      google_rating: lead.google_rating?.toString() ?? "",
      google_review_count: lead.google_review_count?.toString() ?? "",
      stars_html: starsHtml,
      // Design rationale (for debug)
      design_rationale: design.rationale.join(" | "),
      component_style: design.componentStyle,
      hero_variant: design.hero.variant,
      // Conditional flags
      has_logo: hasLogo ? "true" : "",
      has_hero_image: hasHeroImage ? "true" : "",
      no_hero_image: hasHeroImage ? "" : "true",
      has_gallery: hasGallery ? "true" : "",
      has_menu: hasMenu ? "true" : "",
      has_reviews: hasReviews ? "true" : "",
      has_rating: hasRating ? "true" : "",
      has_hours: hasHours ? "true" : "",
      has_map: hasMap ? "true" : "",
      has_address: address ? "true" : "",
      has_trust_badges: design.hero.showTrustBadges ? "true" : "",
    };

    // Use design system CSS instead of template CSS
    let css = designCss;
    let html = template.html_template;

    for (const [key, value] of Object.entries(templateVars)) {
      css = css.replaceAll(`{{${key}}}`, value);
    }
    templateVars.css = css;

    for (const [key, value] of Object.entries(templateVars)) {
      html = html.replaceAll(`{{${key}}}`, value);
    }

    html = processConditionals(html, templateVars);

    const siteName = `${businessName} — ${businessType.charAt(0).toUpperCase() + businessType.slice(1)}`;
    const domain = `${businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;

    const assetsUsed: string[] = [];
    if (hasLogo) assetsUsed.push(brand!.logo_path!);
    if (hasHeroImage) assetsUsed.push(heroPhoto!.filename);
    galleryPhotos.slice(0, 8).forEach((p) => assetsUsed.push(p.filename));

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
      brand_source: design.colours.source,
      // Design system metadata
      has_reviews: hasReviews,
      has_map: hasMap,
      has_hours: hasHours,
      has_gallery: hasGallery,
      has_menu: hasMenu,
      sections_count: countSections(templateVars),
      design_rationale: design.rationale,
      component_style: design.componentStyle,
      hero_variant: design.hero.variant,
      font_pairing: `${design.fonts.heading} / ${design.fonts.body}`,
    });
  }

  const withBrand = generatedSites.filter((s) => s.brand_source !== "vertical_default").length;
  const withReviews = generatedSites.filter((s) => s.has_reviews).length;
  const withMaps = generatedSites.filter((s) => s.has_map).length;

  return {
    summary: `Generated ${generatedSites.length} landing pages. ${withBrand} with real brand data. ${withReviews} with testimonials. ${withMaps} with maps.`,
    artifacts: {
      sites: generatedSites,
      generated_count: generatedSites.length,
    },
  };
};

// ---------------------------------------------------------------------------
// Content generation — smarter, more varied
// ---------------------------------------------------------------------------

function generateTagline(name: string, type: string, vertical: string): string {
  const taglines: Record<string, string[]> = {
    trades: [
      `Your Trusted Local ${capitalize(type)}`,
      `${capitalize(type)} Services Done Right, Every Time`,
      `Reliable ${capitalize(type)} You Can Count On`,
      `Quality ${capitalize(type)} Work — Guaranteed`,
    ],
    food: [
      `Welcome to ${name}`,
      `Good Food, Great Company`,
      `Fresh Flavours, Warm Welcome`,
      `A Taste of Something Special`,
    ],
    health: [
      `Look Good, Feel Amazing`,
      `Your Wellbeing, Our Passion`,
      `Where Self-Care Meets Excellence`,
      `Premium ${capitalize(type)} Services`,
    ],
    professional: [
      `Expert ${capitalize(type)} You Can Trust`,
      `Professional. Reliable. Results.`,
      `Your Success Is Our Business`,
      `Trusted ${capitalize(type)} Advice`,
    ],
    retail: [
      `Welcome to ${name}`,
      `Quality Products, Personal Service`,
      `Discover Something Special`,
      `Your Local ${capitalize(type)} — Since Day One`,
    ],
  };
  const options = taglines[vertical] ?? taglines.trades;
  return options[hashString(name) % options.length];
}

function generateHeroDescription(name: string, type: string, lead: LeadData): string {
  const ratingText = lead.google_rating && lead.google_review_count && lead.google_review_count > 3
    ? ` Rated ${lead.google_rating} stars by ${lead.google_review_count} happy customers.`
    : "";
  const locationText = lead.address ? ` Serving ${lead.address} and surrounding areas.` : "";
  return `${name} provides reliable, professional ${type} services you can count on.${ratingText}${locationText}`;
}

function generateAboutText(name: string, type: string, lead: LeadData): string {
  const reviewMention = lead.google_review_count && lead.google_review_count > 10
    ? ` With over ${lead.google_review_count} positive reviews, we've built a reputation for quality and reliability.`
    : "";
  const locationMention = lead.address ? ` Based in ${lead.address}, we serve` : " We serve";
  return `${name} is a dedicated local ${type}${locationMention} customers across the area. We take pride in delivering excellent results every time — because your satisfaction is what drives us.${reviewMention}`;
}

function generateServiceDesc(service: string, businessType: string): string {
  const lower = service.toLowerCase();
  if (lower.includes("repair")) return "Fast, reliable repairs when you need them most.";
  if (lower.includes("install")) return "Professional installation with attention to detail.";
  if (lower.includes("emergency")) return "Available when you need us — fast response guaranteed.";
  if (lower.includes("consult")) return "Expert guidance tailored to your specific needs.";
  if (lower.includes("maintenance")) return "Keep everything running smoothly with regular maintenance.";
  return `Quality ${businessType} service delivered with care and professionalism.`;
}

function generateServicesHtml(type: string, vertical: string): string {
  const servicesByVertical: Record<string, Array<{ name: string; desc: string }>> = {
    trades: [
      { name: "Emergency Repairs", desc: "Fast response when you need us most — available 7 days a week." },
      { name: "New Installations", desc: "Professional installation with quality materials and a clean finish." },
      { name: "Regular Maintenance", desc: "Preventative maintenance to keep everything running smoothly." },
      { name: "Free Quotes", desc: "No-obligation quotes with transparent, competitive pricing." },
    ],
    food: [
      { name: "Dine In", desc: "Enjoy a relaxed meal in our welcoming atmosphere." },
      { name: "Takeaway", desc: "All your favourites, ready to enjoy at home." },
      { name: "Catering", desc: "Let us cater your next event — from small gatherings to large parties." },
      { name: "Private Events", desc: "Host your special occasion with us for an unforgettable experience." },
    ],
    health: [
      { name: "Consultations", desc: "Personalised consultations to understand exactly what you need." },
      { name: "Treatments", desc: "Professional treatments using premium products and techniques." },
      { name: "Wellness Plans", desc: "Tailored plans designed around your goals and lifestyle." },
      { name: "Walk-Ins Welcome", desc: "No appointment? No problem — walk-ins are always welcome." },
    ],
    professional: [
      { name: "Initial Consultation", desc: "A no-obligation conversation to understand your needs." },
      { name: "Specialist Advice", desc: "Expert guidance from qualified professionals." },
      { name: "Ongoing Support", desc: "We're here for the long term — not just a one-off service." },
      { name: "Flexible Plans", desc: "Solutions that fit your budget and timeline." },
    ],
    retail: [
      { name: "In-Store Shopping", desc: "Browse our curated selection in a friendly, relaxed setting." },
      { name: "Click & Collect", desc: "Order online and pick up at your convenience." },
      { name: "Special Orders", desc: "Can't find what you need? We'll source it for you." },
      { name: "Gift Cards", desc: "The perfect gift for someone special." },
    ],
  };
  const services = servicesByVertical[vertical] ?? servicesByVertical.trades;
  return services
    .map((s) => `<div class="service-card"><h3>${s.name}</h3><p>${s.desc}</p></div>`)
    .join("\n        ");
}

function generateCtaHeading(_name: string, vertical: string): string {
  const headings: Record<string, string> = {
    trades: "Ready to Get Started?",
    food: "Hungry? Come Visit Us",
    health: "Book Your Appointment Today",
    professional: "Let's Talk About Your Needs",
    retail: "Come See Us In Store",
  };
  return headings[vertical] ?? "Get In Touch Today";
}

function generateCtaSubtext(name: string, type: string, vertical: string): string {
  const texts: Record<string, string> = {
    trades: `Get a free, no-obligation quote from ${name}. We're here to help.`,
    food: `We'd love to welcome you to ${name}. Reserve your table or order for collection.`,
    health: `Take the first step — book with ${name} and experience the difference.`,
    professional: `Contact ${name} for a confidential, no-obligation conversation.`,
    retail: `Pop into ${name} and discover something special. We're always happy to help.`,
  };
  return texts[vertical] ?? `Contact ${name} today — we'd love to hear from you.`;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function countSections(vars: Record<string, string>): number {
  let count = 3; // hero + services + contact always present
  if (vars.has_gallery) count++;
  if (vars.has_reviews) count++;
  if (vars.has_hours) count++;
  if (vars.has_map) count++;
  if (vars.has_menu) count++;
  count++; // CTA section
  return count;
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

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function smartTruncate(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  const truncated = s.slice(0, maxLen);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > maxLen * 0.7 ? truncated.slice(0, lastSpace) : truncated) + "…";
}

function safeJsonParse<T>(json: string | undefined, fallback: T): T {
  if (!json) return fallback;
  try { return JSON.parse(json) as T; } catch { return fallback; }
}
