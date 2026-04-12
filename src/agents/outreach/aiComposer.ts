/**
 * AI Composer — generates unique, professional HTML+CSS using Claude via OpenRouter.
 *
 * Uses VISION: sends actual business photos as base64 image blocks so Claude can
 * SEE the business and design around what it sees. This is the key difference from
 * text-only prompting — Claude designs with its eyes open.
 *
 * Each generated site is genuinely unique — different layouts, visual approaches,
 * and copy — tailored specifically to the business.
 */

import type { SiteBrief } from "./briefGenerator.js";
import type { DesignDecision } from "./designSystem.js";
import {
  selectImagesForVision,
  buildAssetUrl,
  getManifest,
  listAssets,
  type VisionImage,
} from "../../lib/assetStore.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AIComposerAssets {
  leadId: string;
  logoUrl: string;
  heroUrl: string;
  galleryUrls: string[];
}

export interface AIComposerResult {
  html: string;
  tokensUsed: number;
  costUsd: number;
  imagesUsed: number;
}

export interface InstagramData {
  username?: string;
  bio?: string;
  followers?: number;
  category?: string;
  posts?: Array<{
    caption?: string;
    likes?: number;
    comments?: number;
    hashtags?: string[];
    url?: string;
  }>;
  topHashtags?: Array<{ tag: string; count: number }>;
  avgEngagement?: { likes?: number; comments?: number };
}

// ---------------------------------------------------------------------------
// OpenRouter config
// ---------------------------------------------------------------------------

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY ?? process.env.OPENAI_API_KEY ?? "";
const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";
const AI_COMPOSER_MODEL = process.env.AI_COMPOSER_MODEL ?? "anthropic/claude-sonnet-4-20250514";
const AI_COMPOSER_TIMEOUT_MS = Number(process.env.AI_COMPOSER_TIMEOUT_MS ?? "180000");

// Sonnet pricing via OpenRouter (approximate)
const INPUT_COST_PER_M = 3.0;
const OUTPUT_COST_PER_M = 15.0;

// ---------------------------------------------------------------------------
// System prompt — short, creative freedom
// ---------------------------------------------------------------------------

function buildSystemPrompt(): string {
  return `You are a world-class web designer who can SEE businesses through their photos. You design bespoke single-page websites that feel hand-crafted for each specific business.

You will receive:
- Photos of the actual business (website screenshots, logo, interior/exterior, Instagram posts)
- Business details, services, reviews, and contact info
- A colour palette extracted from their branding (use as a starting point, adjust based on what you see)
- Image URLs to use in the HTML output

CRITICAL RULES:
1. Return ONLY the complete HTML document. No markdown fences, no explanations. Start with <!DOCTYPE html> and end with </html>.
2. Output a SINGLE HTML file with all CSS in a <style> tag.
3. Use ONLY the image URLs provided — do NOT invent filenames or URLs.
4. All contact details (phone, email, address) must be accurate — use exactly what's provided.
5. Customer reviews are REAL — use them verbatim, don't paraphrase.
6. Mobile-first responsive design with clean breakpoints.
7. Semantic HTML (header, nav, main, section, footer).

DESIGN PHILOSOPHY:
- Let the photos guide your design. The images tell you more about the brand than any hex code.
- The site should look like it costs £2000+ to build — premium, polished, unique.
- Bold use of brand colours — NOT grey, NOT plain white backgrounds.
- Hero section: dramatic, at least 70vh tall. Use hero/main photo as full-width background with gradient overlay.
- Gallery images: attractive grid with hover effects. Display ALL provided gallery images prominently.
- Use object-fit: cover, proper aspect ratios — never stretch or distort images.
- Smooth scroll, subtle CSS animations (fade-in, hover effects).
- Sticky header, CTA buttons with hover effects, alternating section backgrounds.
- Write copy that matches the brand's personality — not generic corporate speak.`;
}

// ---------------------------------------------------------------------------
// Instagram context builder
// ---------------------------------------------------------------------------

function buildInstagramContext(ig: InstagramData): string {
  if (!ig || (!ig.username && !ig.bio)) return "";

  const lines: string[] = [];
  if (ig.username) lines.push(`Instagram: @${ig.username}`);
  if (ig.bio) lines.push(`Bio: "${ig.bio}"`);

  const meta: string[] = [];
  if (ig.followers) meta.push(`${ig.followers.toLocaleString()} followers`);
  if (ig.category) meta.push(ig.category);
  if (meta.length) lines.push(meta.join(" | "));

  if (ig.posts && ig.posts.length > 0) {
    lines.push("\nRecent posts (top by engagement):");
    for (const post of ig.posts.slice(0, 5)) {
      const caption = post.caption?.slice(0, 120) ?? "(no caption)";
      const engagement: string[] = [];
      if (post.likes) engagement.push(`${post.likes} likes`);
      if (post.comments) engagement.push(`${post.comments} comments`);
      const tags = post.hashtags?.slice(0, 5).map((t) => `#${t}`).join(" ") ?? "";
      lines.push(`  - "${caption}" — ${engagement.join(", ")}${tags ? `\n    ${tags}` : ""}`);
    }
  }

  if (ig.topHashtags && ig.topHashtags.length > 0) {
    lines.push(`\nTop hashtags: ${ig.topHashtags.slice(0, 8).map((h) => `#${h.tag} (${h.count})`).join(", ")}`);
  }

  if (ig.avgEngagement) {
    const parts: string[] = [];
    if (ig.avgEngagement.likes) parts.push(`${ig.avgEngagement.likes} likes`);
    if (ig.avgEngagement.comments) parts.push(`${ig.avgEngagement.comments} comments`);
    if (parts.length) lines.push(`Avg engagement: ${parts.join(", ")} per post`);
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Build multipart user content (text + vision images interleaved)
// ---------------------------------------------------------------------------

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

function buildUserContent(
  brief: SiteBrief,
  design: DesignDecision,
  images: VisionImage[],
  assets: AIComposerAssets,
  instagramContext: string,
): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const text = (t: string) => blocks.push({ type: "text", text: t });
  const image = (img: VisionImage) => blocks.push({
    type: "image_url",
    image_url: { url: `data:${img.mediaType};base64,${img.base64}` },
  });

  // --- Website screenshot ---
  const screenshotImg = images.find((i) => i.role === "screenshot");
  if (screenshotImg) {
    text("=== THEIR EXISTING WEBSITE (screenshot of current site) ===\nStudy their current design: colours, layout, typography, brand feel. Design something BETTER that keeps their identity.");
    image(screenshotImg);
  }

  // --- Logo ---
  const logoImg = images.find((i) => i.role === "logo");
  if (logoImg) {
    text("=== LOGO ===\nThis is their actual logo. Match your design to complement it.");
    image(logoImg);
  }

  // --- Hero photo ---
  const heroImg = images.find((i) => i.role === "hero");
  if (heroImg) {
    text("=== HERO PHOTO — use as full-width hero background ===\nThis is the main photo of the business. Use it as a dramatic full-width hero with a dark gradient overlay for text readability.");
    image(heroImg);
  }

  // --- Instagram ---
  const igImages = images.filter((i) => i.role === "instagram");
  if (igImages.length > 0 || instagramContext) {
    text(`=== INSTAGRAM — this is how they present themselves ===\n${instagramContext || "Instagram photos showing their visual style and personality:"}`);
    for (const img of igImages) {
      image(img);
    }
  }

  // --- Gallery photos ---
  const galleryImages = images.filter((i) => i.role === "gallery");
  if (galleryImages.length > 0) {
    text("=== GALLERY PHOTOS — use these in a gallery/showcase section ===\nReal photos of the business, products, or services:");
    for (const img of galleryImages) {
      image(img);
    }
  }

  // --- Business details ---
  const details: string[] = [
    `=== BUSINESS DETAILS ===`,
    `Name: ${brief.businessName}`,
    `Type: ${brief.businessType} (${brief.vertical})`,
    `Category: ${brief.specificCategory}`,
    `Description: ${brief.description}`,
    ``,
    `Phone: ${brief.phone}`,
    `Email: ${brief.email}`,
    `Address: ${brief.address}`,
  ];
  if (brief.googleRating) {
    details.push(`Google Rating: ${brief.googleRating}★ from ${brief.googleReviewCount} reviews`);
  }

  // Services
  details.push(`\n=== SERVICES ===`);
  for (const s of brief.services) {
    details.push(`- ${s.name}: ${s.description}`);
  }

  // Reviews
  if (brief.bestReviews.length > 0) {
    details.push(`\n=== CUSTOMER REVIEWS (REAL — use verbatim) ===`);
    for (const r of brief.bestReviews) {
      details.push(`- "${r.text.slice(0, 250)}" — ${r.author} (${r.rating}★)`);
    }
  }

  // Hours
  if (brief.openingHours.length > 0) {
    details.push(`\n=== OPENING HOURS ===`);
    for (const h of brief.openingHours) details.push(`- ${h}`);
  }

  // Menu
  if (brief.menuItems && brief.menuItems.length > 0) {
    details.push(`\n=== MENU ITEMS ===`);
    for (const m of brief.menuItems.slice(0, 20)) {
      details.push(`- ${m.name}${m.price ? ` — ${m.price}` : ""}${m.description ? ` (${m.description})` : ""}`);
    }
  }

  text(details.join("\n"));

  // --- Brand personality (from brand-intelligence) ---
  const personalityLines: string[] = ["=== BRAND PERSONALITY ==="];
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
  if (personalityLines.length > 1) {
    text(personalityLines.join("\n"));
  }

  // --- Colour palette (suggestions, not rigid) ---
  const { colours, fonts } = design;
  const googleFontsUrl = `https://fonts.googleapis.com/css2?family=${fonts.headingImport}&family=${fonts.bodyImport}&display=swap`;
  text(`=== COLOUR PALETTE (from their brand — adjust based on what you see in the photos) ===
Primary: ${colours.primary} ← hero backgrounds, CTA buttons
Primary dark: ${colours.primaryDark} ← hover states, footer
Primary light: ${colours.primaryLight} ← section backgrounds
Secondary: ${colours.secondary} ← accent elements
Accent: ${colours.accent} ← highlights, badges
Background: ${colours.background}
Surface: ${colours.surface} ← card backgrounds
Text: ${colours.text}
Gradient: ${colours.gradient}

Typography:
Heading: '${fonts.heading}' (${fonts.headingWeight})
Body: '${fonts.body}' (${fonts.bodyWeight})
Google Fonts: ${googleFontsUrl}

The primary colour MUST be visible above the fold. Do NOT default to grey.`);

  // --- Available image URLs for HTML output ---
  const urlLines: string[] = ["=== AVAILABLE IMAGE URLs FOR HTML (use ONLY these — do not invent URLs) ==="];
  const allAssets = listAssets(assets.leadId);

  // Map vision images to their asset URLs
  for (const img of images) {
    const label = img.role === "screenshot" ? "Website screenshot (for reference only, don't embed)"
      : img.role === "logo" ? "Logo"
      : img.role === "hero" ? "Hero/main photo — use as hero background"
      : img.role === "instagram" ? "Instagram post — use in gallery or showcase"
      : "Gallery photo";
    urlLines.push(`${label}: src="${img.assetUrl}"`);
  }

  // Also include gallery images that weren't sent as vision (still usable in HTML)
  const sentFilenames = new Set(images.map((i) => i.filename));
  const extraGallery = allAssets.filter((a) =>
    !sentFilenames.has(a.filename)
    && (a.category === "gallery" || a.category === "social" || a.category === "hero")
    && /\.(jpg|jpeg|png|webp)$/i.test(a.filename),
  );
  for (const a of extraGallery.slice(0, 12)) {
    urlLines.push(`Additional photo: src="${buildAssetUrl(assets.leadId, a.filename)}"`);
  }

  text(urlLines.join("\n"));

  // --- Copy directives ---
  text(`=== COPY & CTA ===
Hero headline: ${brief.heroHeadline}
Hero subtext: ${brief.heroSubtext}
Primary CTA: "${brief.ctaPrimary.text}" → ${brief.ctaPrimary.action}: ${brief.ctaPrimary.target}
${brief.ctaSecondary ? `Secondary CTA: "${brief.ctaSecondary.text}" → ${brief.ctaSecondary.action}: ${brief.ctaSecondary.target}` : ""}
Trust badges: ${brief.trustBadges.join(" · ")}
About: ${brief.aboutCopy}
${brief.mapsEmbedUrl ? `Google Maps: ${brief.mapsEmbedUrl}` : ""}

Section order: ${brief.sectionOrder.join(" → ")}
DO NOT mention: ${brief.avoidTopics.join(", ")}

Footer: business info + copyright 2026`);

  return blocks;
}

// ---------------------------------------------------------------------------
// Main composer function — vision-powered
// ---------------------------------------------------------------------------

export async function generateSiteWithAI(
  brief: SiteBrief,
  design: DesignDecision,
  assets: AIComposerAssets,
  leadId: string,
  instagramData?: InstagramData,
): Promise<AIComposerResult> {
  if (!OPENROUTER_API_KEY) {
    throw new Error("AI Composer requires OPENROUTER_API_KEY (or OPENAI_API_KEY) to be set");
  }

  // Select and prepare images for vision
  const images = await selectImagesForVision(leadId, 7, 4 * 1024 * 1024);
  const totalImageBytes = images.reduce((sum, i) => sum + i.sizeBytes, 0);
  console.log(`[AI Composer] Prepared ${images.length} images (${(totalImageBytes / 1024).toFixed(0)}KB) for ${brief.businessName}`);
  for (const img of images) {
    console.log(`  ${img.role}: ${img.filename} (${img.width}×${img.height}, ${(img.sizeBytes / 1024).toFixed(0)}KB)`);
  }

  // Build Instagram context
  const igContext = instagramData ? buildInstagramContext(instagramData) : "";

  // Build messages
  const systemPrompt = buildSystemPrompt();
  const userContent = buildUserContent(brief, design, images, assets, igContext);

  console.log(`[AI Composer] Calling ${AI_COMPOSER_MODEL} for ${brief.businessName} (${images.length} images)...`);
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
          { role: "user", content: userContent },
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
    console.log(`[AI Composer] Done in ${elapsed}s — ${totalTokens} tokens (${promptTokens} in, ${completionTokens} out), $${costUsd.toFixed(4)}, ${images.length} images`);

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
      imagesUsed: images.length,
    };
  } finally {
    clearTimeout(timeout);
  }
}
