/**
 * AI Composer — generates unique, professional HTML+CSS using Claude via OpenRouter.
 *
 * Replaces the deterministic template-filling approach with genuine AI creativity.
 * Takes the structured brief + design decisions + asset URLs and sends them to
 * Claude Sonnet, which generates a complete single-page website from scratch.
 *
 * Each generated site is genuinely unique — different layouts, visual approaches,
 * and copy — tailored specifically to the business.
 */

import type { SiteBrief } from "./briefGenerator.js";
import type { DesignDecision } from "./designSystem.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AIComposerAssets {
  logoUrl: string;
  heroUrl: string;
  galleryUrls: string[];
}

export interface AIComposerResult {
  html: string;
  tokensUsed: number;
  costUsd: number;
}

// ---------------------------------------------------------------------------
// OpenRouter config
// ---------------------------------------------------------------------------

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY ?? process.env.OPENAI_API_KEY ?? "";
const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";
const AI_COMPOSER_MODEL = process.env.AI_COMPOSER_MODEL ?? "anthropic/claude-sonnet-4";
const AI_COMPOSER_TIMEOUT_MS = Number(process.env.AI_COMPOSER_TIMEOUT_MS ?? "120000");

// Sonnet pricing via OpenRouter (approximate)
const INPUT_COST_PER_M = 3.0;
const OUTPUT_COST_PER_M = 15.0;

// ---------------------------------------------------------------------------
// System prompt builder
// ---------------------------------------------------------------------------

function buildSystemPrompt(
  brief: SiteBrief,
  design: DesignDecision,
  assets: AIComposerAssets,
): string {
  const { colours, fonts, hero, componentStyle } = design;

  const googleFontsUrl = `https://fonts.googleapis.com/css2?family=${fonts.headingImport}&family=${fonts.bodyImport}&display=swap`;

  const assetLines: string[] = [];
  if (assets.logoUrl) assetLines.push(`- Logo image: ${assets.logoUrl}`);
  if (assets.heroUrl) assetLines.push(`- Hero/banner image: ${assets.heroUrl}`);
  if (assets.galleryUrls.length > 0) {
    assetLines.push(`- Gallery images (use all of these):`);
    assets.galleryUrls.forEach((url, i) => assetLines.push(`  ${i + 1}. ${url}`));
  }

  const reviewLines = brief.bestReviews.length > 0
    ? brief.bestReviews.map((r) =>
        `  - "${r.text.slice(0, 200)}" — ${r.author} (${r.rating}★)`
      ).join("\n")
    : "  None available";

  const serviceLines = brief.services
    .map((s) => `  - ${s.name}: ${s.description}`)
    .join("\n");

  const hoursLines = brief.openingHours.length > 0
    ? brief.openingHours.map((h) => `  - ${h}`).join("\n")
    : "";

  const menuLines = brief.menuItems && brief.menuItems.length > 0
    ? brief.menuItems.slice(0, 20).map((m) =>
        `  - ${m.name}${m.price ? ` — ${m.price}` : ""}${m.description ? ` (${m.description})` : ""}`
      ).join("\n")
    : "";

  // Brand personality section (from brand-intelligence agent)
  const personalityLines: string[] = [];
  if (brief.brandTone) personalityLines.push(`Voice tone: ${brief.brandTone}`);
  if (brief.heroStyle) personalityLines.push(`Visual aesthetic: ${brief.heroStyle}`);
  if (brief.marketPosition) personalityLines.push(`Market position: ${brief.marketPosition}`);
  if (brief.uniqueSellingPoints && brief.uniqueSellingPoints.length > 0) {
    personalityLines.push(`What makes them special:`);
    brief.uniqueSellingPoints.forEach((u) => personalityLines.push(`  - ${u}`));
  }
  if (brief.voiceExamples && brief.voiceExamples.length > 0) {
    personalityLines.push(`Example copy in their voice:`);
    brief.voiceExamples.forEach((v) => personalityLines.push(`  "${v}"`));
  }

  return `You are a world-class web designer building a bespoke single-page website for a real small business. This is NOT a template — it must feel hand-crafted for THIS specific business, reflecting their unique personality, brand, and neighbourhood character.

CRITICAL: Return ONLY the complete HTML document. No markdown fences, no explanations, no commentary. Start with <!DOCTYPE html> and end with </html>.

═══════════════════════════════════════════════════
BRAND PERSONALITY & VOICE (THIS DRIVES EVERYTHING)
═══════════════════════════════════════════════════
${personalityLines.length > 0 ? personalityLines.join("\n") : `This is a ${brief.businessType} — design for the aesthetic expectations of this industry.`}

The personality above should drive EVERY design choice: colour usage, whitespace,
typography scale, image treatment, copy tone, and layout rhythm. A luxury salon
looks nothing like a neighbourhood bakery. A confident barber shop looks nothing
like a gentle dentist. Let the brand breathe through the design.

═══════════════════════════════════════════════════
BUSINESS IDENTITY
═══════════════════════════════════════════════════
Name: ${brief.businessName}
Type: ${brief.businessType} (${brief.vertical} vertical)
Category: ${brief.specificCategory}
Description: ${brief.description}

Phone: ${brief.phone}
Email: ${brief.email}
Address: ${brief.address}
${brief.googleRating ? `Google Rating: ${brief.googleRating}★ from ${brief.googleReviewCount} reviews` : ""}

═══════════════════════════════════════════════════
SERVICES
═══════════════════════════════════════════════════
${serviceLines}

═══════════════════════════════════════════════════
CUSTOMER REVIEWS (USE THESE — they are REAL)
═══════════════════════════════════════════════════
${reviewLines}

${hoursLines ? `═══════════════════════════════════════════════════
OPENING HOURS
═══════════════════════════════════════════════════
${hoursLines}` : ""}

${menuLines ? `═══════════════════════════════════════════════════
MENU ITEMS
═══════════════════════════════════════════════════
${menuLines}` : ""}

═══════════════════════════════════════════════════
COLOUR PALETTE (USE THESE PROMINENTLY — NOT grey!)
═══════════════════════════════════════════════════
These colours were extracted from the actual business branding. USE THEM BOLDLY:
- Primary: ${colours.primary} ← hero backgrounds, CTA buttons, key headings
- Primary dark: ${colours.primaryDark} ← hover states, footer backgrounds
- Primary light: ${colours.primaryLight} ← section backgrounds, subtle tints
- Secondary: ${colours.secondary} ← accent elements, alternating sections
- Accent: ${colours.accent} ← highlights, badges, call-outs
- Background: ${colours.background} ← page base (NOT plain grey or white)
- Surface: ${colours.surface} ← card backgrounds
- Text: ${colours.text}
- Text muted: ${colours.textMuted}
- Text on primary: ${colours.textOnPrimary}
- Gradient: ${colours.gradient} ← hero overlays, section transitions

DO NOT default to grey, plain white, or generic dark backgrounds.
The primary colour should be visible within the first screen fold.

═══════════════════════════════════════════════════
TYPOGRAPHY
═══════════════════════════════════════════════════
Heading font: '${fonts.heading}' (weight: ${fonts.headingWeight})
Body font: '${fonts.body}' (weight: ${fonts.bodyWeight})
Google Fonts import: ${googleFontsUrl}

═══════════════════════════════════════════════════
IMAGES & PHOTOS (CRITICAL — USE ALL OF THESE)
═══════════════════════════════════════════════════
${assetLines.length > 0 ? `These are REAL photos of the actual business, scraped from Google and Instagram.
They must be prominently displayed — they are the most compelling part of the site.

${assetLines.join("\n")}

Image usage rules:
- Hero image: use as a FULL-WIDTH background with a dark gradient overlay for text readability
- Gallery images: display in an attractive grid/masonry layout with hover effects
- Use object-fit: cover and proper aspect ratios — never stretch or distort
- Add subtle border-radius and shadows to gallery images
- Images should take up significant visual space — they sell the business` : "No images available — use bold colour gradients and patterns as visual interest instead. Use the primary and secondary colours creatively for hero sections and backgrounds."}

═══════════════════════════════════════════════════
LAYOUT & COMPONENTS
═══════════════════════════════════════════════════
Component style: ${componentStyle}
Hero variant: ${hero.variant}
Hero text alignment: ${hero.textAlign}
Corner radius: ${design.layout.cornerRadius}
Shadow depth: ${design.layout.shadowDepth}
Section spacing: ${design.layout.sectionSpacing}

═══════════════════════════════════════════════════
COPY & CTA DIRECTIVES
═══════════════════════════════════════════════════
Hero headline: ${brief.heroHeadline}
Hero subtext: ${brief.heroSubtext}

Primary CTA: "${brief.ctaPrimary.text}" → action: ${brief.ctaPrimary.action}, target: ${brief.ctaPrimary.target}
  Rationale: ${brief.ctaPrimary.why}
${brief.ctaSecondary ? `Secondary CTA: "${brief.ctaSecondary.text}" → action: ${brief.ctaSecondary.action}, target: ${brief.ctaSecondary.target}` : ""}

Trust badges: ${brief.trustBadges.join(" · ")}

About copy: ${brief.aboutCopy}

═══════════════════════════════════════════════════
SECTION ORDER (follow this sequence)
═══════════════════════════════════════════════════
${brief.sectionOrder.map((s, i) => `${i + 1}. ${s}`).join("\n")}

═══════════════════════════════════════════════════
AVOID TOPICS (DO NOT mention any of these)
═══════════════════════════════════════════════════
${brief.avoidTopics.join(", ")}

═══════════════════════════════════════════════════
DESIGN REQUIREMENTS
═══════════════════════════════════════════════════
1. Output a SINGLE complete HTML file with all CSS in a <style> tag
2. USE the brand colours PROMINENTLY — the primary colour must be visible above the fold
3. Mobile-first responsive design with clean breakpoints
4. The design must feel BESPOKE for this specific business — not a generic template
5. Smooth scroll behaviour, subtle CSS animations (fade-in on scroll, hover effects)
6. Sticky header with logo text + nav. Use primary colour or transparent-to-solid on scroll
7. Hero section: if hero image exists, use it FULL-WIDTH with dark gradient overlay.
   The hero should be dramatic and impactful — at least 70vh tall
8. If no hero image, use a bold gradient hero using primary/secondary colours
9. Service cards with visual hierarchy — use accent colour for highlights
10. Testimonial cards showing real review text with star ratings (★ characters)
11. Gallery: attractive grid with hover zoom effects. Show ALL provided gallery images
12. If menu items exist, elegant menu layout with prices
13. If opening hours exist, clean formatted display
14. ${brief.mapsEmbedUrl ? `Include Google Maps embed: ${brief.mapsEmbedUrl}` : "Contact section with address"}
15. Footer with primary-dark background, business info, copyright 2026
16. Semantic HTML throughout (header, nav, main, section, footer)
17. CTA buttons: use primary colour bg, large, rounded, with hover effect
18. Alternate section backgrounds between white/surface/primary-light for visual rhythm
19. The site should look like it costs £2000+ to build — premium, polished, unique
20. Write copy that matches the brand voice/tone — NOT generic corporate speak

REMEMBER: Return ONLY the HTML. No markdown, no explanation. Start with <!DOCTYPE html>.`;
}

// ---------------------------------------------------------------------------
// Main composer function
// ---------------------------------------------------------------------------

export async function generateSiteWithAI(
  brief: SiteBrief,
  design: DesignDecision,
  assets: AIComposerAssets,
  _leadId: string,
): Promise<AIComposerResult> {
  if (!OPENROUTER_API_KEY) {
    throw new Error("AI Composer requires OPENROUTER_API_KEY (or OPENAI_API_KEY) to be set");
  }

  const systemPrompt = buildSystemPrompt(brief, design, assets);
  const toneHint = brief.brandTone ? ` The tone should be ${brief.brandTone}.` : "";
  const posHint = brief.marketPosition ? ` Position as ${brief.marketPosition}.` : "";
  const userPrompt = `Generate the complete website for ${brief.businessName} — a ${brief.businessType} in ${brief.address || "the local area"}.${toneHint}${posHint} Use the brand colours BOLDLY (not grey!), embed ALL provided images prominently, and make the copy feel like it was written BY this business, not about a generic one. This site must make the business owner think "that looks like MY business."`;

  console.log(`[AI Composer] Calling ${AI_COMPOSER_MODEL} for ${brief.businessName}...`);
  const t0 = Date.now();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_COMPOSER_TIMEOUT_MS);

  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "https://localhost",
        "X-Title": process.env.OPENROUTER_APP_NAME ?? "openclaw-site-composer",
      },
      body: JSON.stringify({
        model: AI_COMPOSER_MODEL,
        max_tokens: 16000,
        temperature: 0.7,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenRouter API error ${response.status}: ${body}`);
    }

    const payload = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };

    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("OpenRouter response missing message content");
    }

    const promptTokens = payload.usage?.prompt_tokens ?? 0;
    const completionTokens = payload.usage?.completion_tokens ?? 0;
    const totalTokens = promptTokens + completionTokens;

    const costUsd = (promptTokens / 1_000_000) * INPUT_COST_PER_M
                  + (completionTokens / 1_000_000) * OUTPUT_COST_PER_M;

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`[AI Composer] Done in ${elapsed}s — ${totalTokens} tokens, $${costUsd.toFixed(4)}`);

    // Extract HTML from response (strip any markdown fences if model adds them)
    let html = content.trim();
    if (html.startsWith("```html")) {
      html = html.slice(7);
    } else if (html.startsWith("```")) {
      html = html.slice(3);
    }
    if (html.endsWith("```")) {
      html = html.slice(0, -3);
    }
    html = html.trim();

    // Ensure it starts with DOCTYPE
    if (!html.toLowerCase().startsWith("<!doctype")) {
      const doctypeIdx = html.toLowerCase().indexOf("<!doctype");
      if (doctypeIdx >= 0) {
        html = html.slice(doctypeIdx);
      }
    }

    return {
      html,
      tokensUsed: totalTokens,
      costUsd,
    };
  } finally {
    clearTimeout(timeout);
  }
}
