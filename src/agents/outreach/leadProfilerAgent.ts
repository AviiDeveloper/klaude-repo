import { AgentHandler } from "../../pipeline/agentRuntime.js";
import {
  ensureLeadDir,
  saveBuffer,
  saveScreenshot,
  saveFromUrl,
  type AssetMetadata,
} from "../../lib/assetStore.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LeadToProfile {
  lead_id?: string;
  business_name: string;
  business_type?: string;
  website_url?: string | null;
  google_maps_url?: string | null;
  google_rating?: number;
  google_review_count?: number;
  address?: string;
  phone?: string;
  email?: string;
}

export interface SocialProfile {
  platform: string;
  url: string;
  profile_image_url?: string;
  screenshot_path?: string;
  post_images: string[];
}

export interface ProfileResult {
  lead_id?: string;
  business_name: string;
  business_type?: string;
  google_rating: number | null;
  google_review_count: number | null;
  address?: string;
  phone?: string;
  email?: string;
  has_ssl: 0 | 1;
  is_mobile_friendly: 0 | 1;
  has_social_links: 0 | 1;
  social_links_json: string;
  website_tech_stack: string;
  website_quality_score: number;
  pain_points_json: string;
  profiled_at: string;
  // Brand scraping fields (Phase 2)
  brand_colours_json: string;
  brand_fonts_json: string;
  brand_assets_json: string;
  social_profiles_json: string;
  business_description_raw?: string;
  services_extracted_json: string;
  menu_items_json?: string;
  screenshot_path?: string;
  logo_path?: string;
}

interface ScrapedBrandColours {
  primary?: string;
  secondary?: string;
  accent?: string;
  background?: string;
  text?: string;
  source: "css" | "meta" | "default";
}

// ---------------------------------------------------------------------------
// Playwright lazy loader
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _playwright: any | null | undefined;

async function getPlaywright(): Promise<any | null> {
  if (_playwright !== undefined) return _playwright;
  try {
    _playwright = await import("playwright");
    return _playwright;
  } catch {
    _playwright = null;
    return null;
  }
}

const PI_SAFE_ARGS = [
  "--no-sandbox",
  "--disable-gpu",
  "--disable-dev-shm-usage",
  "--single-process",
  "--disable-setuid-sandbox",
];

// ---------------------------------------------------------------------------
// Website scraping with Playwright
// ---------------------------------------------------------------------------

interface WebsiteScrapeResult {
  screenshot_path?: string;
  logo_path?: string;
  colours: ScrapedBrandColours;
  fonts: string[];
  hero_images: string[];
  social_links: string[];
  description?: string;
  services: string[];
  has_ssl: 0 | 1;
  is_mobile_friendly: 0 | 1;
  tech_stack: string[];
  quality_score: number;
  pain_points: string[];
  html_length: number;
}

async function scrapeWebsiteWithPlaywright(
  url: string,
  leadId: string,
): Promise<WebsiteScrapeResult | null> {
  const pw = await getPlaywright();
  if (!pw) return null;

  let browser;
  try {
    browser = await pw.chromium.launch({
      headless: true,
      args: PI_SAFE_ARGS,
    });

    const page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15_000 });
    await page.waitForTimeout(2000); // let images load

    // 1. Full-page screenshot
    let screenshotPath: string | undefined;
    try {
      const buf = await page.screenshot({ fullPage: true, type: "png" });
      const meta = await saveScreenshot(leadId, "screenshot.png", buf);
      screenshotPath = meta.filename;
    } catch { /* non-fatal */ }

    // 2. Extract data from page context (runs in browser)
    const pageData = await page.evaluate(() => {
      const doc = document;

      // Logo detection
      const logoSelectors = [
        'img[src*="logo" i]',
        'img[alt*="logo" i]',
        'img[class*="logo" i]',
        'img[id*="logo" i]',
        'a[class*="logo" i] img',
        'header img:first-of-type',
        '.logo img',
        '#logo img',
      ];
      let logoUrl: string | null = null;
      for (const sel of logoSelectors) {
        const el = doc.querySelector(sel) as HTMLImageElement | null;
        if (el?.src) { logoUrl = el.src; break; }
      }
      // Fallback: favicon / apple-touch-icon / og:image
      if (!logoUrl) {
        const icon =
          doc.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement ??
          doc.querySelector('link[rel="icon"][sizes]') as HTMLLinkElement ??
          doc.querySelector('meta[property="og:image"]') as HTMLMetaElement;
        if (icon) logoUrl = (icon as HTMLLinkElement).href ?? (icon as unknown as HTMLMetaElement).content;
      }

      // Brand colours from CSS
      const colours: Record<string, string | undefined> = {};
      const themeColor = doc.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
      if (themeColor?.content) colours.primary = themeColor.content;

      // Extract from computed styles on key elements
      const headerEl = doc.querySelector("header") ?? doc.querySelector("nav");
      if (headerEl) {
        const cs = getComputedStyle(headerEl);
        if (cs.backgroundColor && cs.backgroundColor !== "rgba(0, 0, 0, 0)") {
          colours.background = cs.backgroundColor;
        }
        if (cs.color) colours.text = cs.color;
      }

      const heroEl = doc.querySelector(".hero, [class*='hero'], section:first-of-type, .banner");
      if (heroEl) {
        const cs = getComputedStyle(heroEl);
        if (cs.backgroundColor && cs.backgroundColor !== "rgba(0, 0, 0, 0)" && !colours.primary) {
          colours.primary = cs.backgroundColor;
        }
      }

      // CSS custom properties from :root
      const rootStyle = getComputedStyle(doc.documentElement);
      const cssVarNames = ["--primary-color", "--primary", "--brand-color", "--main-color", "--accent-color", "--accent"];
      for (const v of cssVarNames) {
        const val = rootStyle.getPropertyValue(v).trim();
        if (val) {
          if (v.includes("accent")) colours.accent = val;
          else if (!colours.primary) colours.primary = val;
        }
      }

      // Fonts
      const bodyFont = getComputedStyle(doc.body).fontFamily;
      const h1 = doc.querySelector("h1");
      const headingFont = h1 ? getComputedStyle(h1).fontFamily : bodyFont;
      const fonts = [...new Set([headingFont, bodyFont].filter(Boolean))];

      // Hero images
      const heroImages: string[] = [];
      const firstSection = doc.querySelector("section:first-of-type, .hero, [class*='hero'], .banner, header");
      if (firstSection) {
        const imgs = firstSection.querySelectorAll("img");
        imgs.forEach((img) => {
          if (img.src && img.naturalWidth > 200) heroImages.push(img.src);
        });
        // background-image
        const bg = getComputedStyle(firstSection).backgroundImage;
        if (bg && bg !== "none") {
          const match = bg.match(/url\(["']?(.*?)["']?\)/);
          if (match?.[1]) heroImages.push(match[1]);
        }
      }

      // Social links
      const socialLinks: string[] = [];
      const socialPatterns = [
        /https?:\/\/(?:www\.)?facebook\.com\/[^\s"'<>]+/gi,
        /https?:\/\/(?:www\.)?instagram\.com\/[^\s"'<>]+/gi,
        /https?:\/\/(?:www\.)?twitter\.com\/[^\s"'<>]+/gi,
        /https?:\/\/(?:www\.)?linkedin\.com\/[^\s"'<>]+/gi,
        /https?:\/\/(?:www\.)?tiktok\.com\/[^\s"'<>]+/gi,
      ];
      const html = doc.documentElement.outerHTML;
      for (const pattern of socialPatterns) {
        const matches = html.match(pattern);
        if (matches) socialLinks.push(...matches.slice(0, 2));
      }

      // Description
      const metaDesc =
        (doc.querySelector('meta[name="description"]') as HTMLMetaElement)?.content ??
        (doc.querySelector('meta[property="og:description"]') as HTMLMetaElement)?.content;
      let description = metaDesc ?? "";
      if (!description) {
        const aboutSection = doc.querySelector("#about, .about, [class*='about']");
        const firstP = (aboutSection ?? doc.body).querySelector("p");
        if (firstP?.textContent) description = firstP.textContent.trim().slice(0, 500);
      }

      // Services
      const services: string[] = [];
      const serviceEls = doc.querySelectorAll(
        ".service-card, .service, [class*='service'] h3, [class*='service'] h4, ul.services li"
      );
      serviceEls.forEach((el) => {
        const text = el.textContent?.trim();
        if (text && text.length < 100) services.push(text);
      });

      // Tech stack
      const techStack: string[] = [];
      const htmlLower = html.toLowerCase();
      if (htmlLower.includes("wordpress")) techStack.push("WordPress");
      if (htmlLower.includes("wix.com")) techStack.push("Wix");
      if (htmlLower.includes("squarespace")) techStack.push("Squarespace");
      if (htmlLower.includes("shopify")) techStack.push("Shopify");
      if (htmlLower.includes("react")) techStack.push("React");
      if (htmlLower.includes("bootstrap")) techStack.push("Bootstrap");
      if (htmlLower.includes("next")) techStack.push("Next.js");
      if (techStack.length === 0) techStack.push("Unknown/Custom");

      // Mobile-friendly
      const hasViewport = !!doc.querySelector('meta[name="viewport"]');
      const hasSSL = location.protocol === "https:";

      return {
        logoUrl,
        colours,
        fonts,
        heroImages: heroImages.slice(0, 3),
        socialLinks: [...new Set(socialLinks)],
        description,
        services: services.slice(0, 10),
        techStack,
        hasViewport,
        hasSSL,
        htmlLength: html.length,
      };
    });

    // 3. Download logo
    let logoPath: string | undefined;
    if (pageData.logoUrl) {
      try {
        const logoMeta = await saveFromUrl(leadId, "logo.png", pageData.logoUrl, "logo");
        if (logoMeta) logoPath = logoMeta.filename;
      } catch { /* non-fatal */ }
    }

    // 4. Download hero images
    const heroImages: string[] = [];
    for (let i = 0; i < pageData.heroImages.length && i < 3; i++) {
      try {
        const meta = await saveFromUrl(leadId, `hero_${i + 1}.jpg`, pageData.heroImages[i], "hero");
        if (meta) heroImages.push(meta.filename);
      } catch { /* non-fatal */ }
    }

    // 5. Calculate quality score
    let qualityScore = 50;
    if (pageData.hasSSL) qualityScore += 10;
    if (pageData.hasViewport) qualityScore += 15;
    if (pageData.socialLinks.length > 0) qualityScore += 10;
    qualityScore += 15; // page loaded
    qualityScore = Math.min(qualityScore, 100);

    // 6. Pain points
    const painPoints: string[] = [];
    if (!pageData.hasSSL) painPoints.push("No SSL certificate — looks unprofessional and hurts SEO");
    if (!pageData.hasViewport) painPoints.push("Not mobile-friendly — losing mobile customers");
    if (pageData.socialLinks.length === 0) painPoints.push("No social media integration");
    if (pageData.htmlLength < 5000) painPoints.push("Very thin content — may not rank well in search");
    if (pageData.techStack.includes("WordPress") && pageData.htmlLength > 0) {
      painPoints.push("Generic WordPress theme — looks like many other sites");
    }

    // Parse colours — convert rgb() to hex
    const rawColours = pageData.colours as Record<string, string | undefined>;
    const colours: ScrapedBrandColours = {
      source: rawColours.primary ? "css" : "default",
      primary: rawColours.primary ? (rgbToHex(rawColours.primary) ?? rawColours.primary) : undefined,
      secondary: rawColours.secondary ? (rgbToHex(rawColours.secondary) ?? rawColours.secondary) : undefined,
      accent: rawColours.accent ? (rgbToHex(rawColours.accent) ?? rawColours.accent) : undefined,
      background: rawColours.background ? (rgbToHex(rawColours.background) ?? rawColours.background) : undefined,
      text: rawColours.text ? (rgbToHex(rawColours.text) ?? rawColours.text) : undefined,
    };

    await browser.close();

    return {
      screenshot_path: screenshotPath,
      logo_path: logoPath,
      colours,
      fonts: pageData.fonts,
      hero_images: heroImages,
      social_links: pageData.socialLinks,
      description: pageData.description || undefined,
      services: pageData.services,
      has_ssl: pageData.hasSSL ? 1 : 0,
      is_mobile_friendly: pageData.hasViewport ? 1 : 0,
      tech_stack: pageData.techStack,
      quality_score: qualityScore,
      pain_points: painPoints,
      html_length: pageData.htmlLength,
    };
  } catch (err) {
    try { browser?.close(); } catch { /* ignore */ }
    return null;
  }
}

// ---------------------------------------------------------------------------
// Social media scraping
// ---------------------------------------------------------------------------

async function scrapeSocialProfiles(
  socialLinks: string[],
  leadId: string,
): Promise<SocialProfile[]> {
  const pw = await getPlaywright();
  if (!pw || socialLinks.length === 0) return [];

  const profiles: SocialProfile[] = [];
  let browser;

  try {
    browser = await pw.chromium.launch({ headless: true, args: PI_SAFE_ARGS });

    for (const url of socialLinks.slice(0, 4)) {
      const platform = detectPlatform(url);
      if (!platform) continue;
      // Skip duplicates
      if (profiles.some((p) => p.platform === platform)) continue;

      const profile: SocialProfile = { platform, url, post_images: [] };

      try {
        const page = await browser.newPage({
          viewport: { width: 1280, height: 720 },
          userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        });

        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 12_000 });
        await page.waitForTimeout(3000);

        // Screenshot
        try {
          const buf = await page.screenshot({ type: "png" });
          const meta = await saveScreenshot(leadId, `${platform}_screenshot.png`, buf);
          profile.screenshot_path = meta.filename;
        } catch { /* non-fatal */ }

        // Platform-specific image extraction
        if (platform === "instagram") {
          const imgUrls = await page.evaluate(() => {
            const imgs = Array.from(document.querySelectorAll("article img, main img"));
            return imgs.map((i) => (i as HTMLImageElement).src).filter(Boolean).slice(0, 6);
          });
          for (let i = 0; i < imgUrls.length && i < 6; i++) {
            try {
              const meta = await saveFromUrl(leadId, `instagram_${i + 1}.jpg`, imgUrls[i], "social");
              if (meta) profile.post_images.push(meta.filename);
            } catch { /* non-fatal */ }
          }
        } else if (platform === "facebook") {
          const imgUrls = await page.evaluate(() => {
            const cover = document.querySelector('[data-imgperflogname="profileCoverPhoto"] img, .cover img') as HTMLImageElement;
            const profileImg = document.querySelector('svg image, [role="img"] img, .profilePic') as HTMLImageElement;
            return [cover?.src, profileImg?.src].filter(Boolean) as string[];
          });
          for (let i = 0; i < imgUrls.length; i++) {
            try {
              const meta = await saveFromUrl(leadId, `facebook_${i + 1}.jpg`, imgUrls[i], "social");
              if (meta) profile.post_images.push(meta.filename);
            } catch { /* non-fatal */ }
          }
        }

        await page.close();
      } catch {
        // Social scraping is best-effort
      }

      profiles.push(profile);
    }

    await browser.close();
  } catch {
    try { browser?.close(); } catch { /* ignore */ }
  }

  return profiles;
}

// ---------------------------------------------------------------------------
// Menu extraction (food vertical)
// ---------------------------------------------------------------------------

interface MenuItem {
  name: string;
  price?: string;
  description?: string;
}

async function extractMenuFromUrl(
  websiteUrl: string,
  leadId: string,
): Promise<MenuItem[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(websiteUrl, { signal: controller.signal });
    clearTimeout(timer);
    const html = await res.text();

    // Find menu links
    const menuLinkMatch = html.match(/href=["']([^"']*menu[^"']*)["']/i);
    if (!menuLinkMatch) return [];

    let menuUrl = menuLinkMatch[1];
    if (menuUrl.startsWith("/")) {
      const base = new URL(websiteUrl);
      menuUrl = `${base.origin}${menuUrl}`;
    }

    // If PDF, download it
    if (menuUrl.toLowerCase().endsWith(".pdf")) {
      await saveFromUrl(leadId, "menu.pdf", menuUrl, "menu");
      return [];
    }

    // Fetch menu page and extract items
    const menuRes = await fetch(menuUrl, { signal: AbortSignal.timeout(10_000) });
    const menuHtml = await menuRes.text();

    // Simple regex for "Item Name ... £XX.XX" patterns
    const items: MenuItem[] = [];
    const pricePattern = /([A-Z][^£$\n]{2,50})\s*[£$]\s*(\d+(?:\.\d{2})?)/g;
    let match;
    while ((match = pricePattern.exec(menuHtml)) !== null && items.length < 30) {
      items.push({ name: match[1].trim(), price: `£${match[2]}` });
    }

    return items;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Fallback: basic fetch profiler (original logic)
// ---------------------------------------------------------------------------

async function profileWithFetch(lead: LeadToProfile): Promise<Partial<ProfileResult>> {
  const result: Partial<ProfileResult> = {};

  if (!lead.website_url) {
    return {
      has_ssl: 0,
      is_mobile_friendly: 0,
      website_quality_score: 0,
      pain_points_json: JSON.stringify([
        "No website at all — missing out on online customers",
        "No online presence beyond social media or directory listings",
        "Competitors with websites are capturing their potential customers",
      ]),
      brand_colours_json: JSON.stringify({}),
      brand_fonts_json: JSON.stringify([]),
      brand_assets_json: JSON.stringify({}),
      social_profiles_json: JSON.stringify([]),
      services_extracted_json: JSON.stringify([]),
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const response = await fetch(lead.website_url, {
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeout);

    const html = await response.text();
    const htmlLower = html.toLowerCase();

    result.has_ssl = lead.website_url.startsWith("https://") ? 1 : 0;
    result.is_mobile_friendly = htmlLower.includes("viewport") ? 1 : 0;

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
    result.has_social_links = socialLinks.length > 0 ? 1 : 0;
    result.social_links_json = JSON.stringify(socialLinks);

    const techStack: string[] = [];
    if (htmlLower.includes("wordpress")) techStack.push("WordPress");
    if (htmlLower.includes("wix.com")) techStack.push("Wix");
    if (htmlLower.includes("squarespace")) techStack.push("Squarespace");
    if (htmlLower.includes("shopify")) techStack.push("Shopify");
    if (htmlLower.includes("react")) techStack.push("React");
    if (htmlLower.includes("bootstrap")) techStack.push("Bootstrap");
    if (techStack.length === 0) techStack.push("Unknown/Custom");
    result.website_tech_stack = JSON.stringify(techStack);

    let qualityScore = 50;
    if (result.has_ssl) qualityScore += 10;
    if (result.is_mobile_friendly) qualityScore += 15;
    if (result.has_social_links) qualityScore += 10;
    if (response.status === 200) qualityScore += 15;
    result.website_quality_score = Math.min(qualityScore, 100);

    const painPoints: string[] = [];
    if (!result.has_ssl) painPoints.push("No SSL certificate — looks unprofessional and hurts SEO");
    if (!result.is_mobile_friendly) painPoints.push("Not mobile-friendly — losing mobile customers");
    if (!result.has_social_links) painPoints.push("No social media integration");
    if (html.length < 5000) painPoints.push("Very thin content — may not rank well in search");
    result.pain_points_json = JSON.stringify(painPoints);

    // Extract description
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)/i);
    result.business_description_raw = descMatch?.[1] ?? undefined;

    result.brand_colours_json = JSON.stringify({});
    result.brand_fonts_json = JSON.stringify([]);
    result.brand_assets_json = JSON.stringify({});
    result.social_profiles_json = JSON.stringify([]);
    result.services_extracted_json = JSON.stringify([]);
  } catch {
    result.website_quality_score = 0;
    result.pain_points_json = JSON.stringify(["Website unreachable or very slow"]);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function detectPlatform(url: string): string | null {
  if (url.includes("instagram.com")) return "instagram";
  if (url.includes("facebook.com")) return "facebook";
  if (url.includes("twitter.com") || url.includes("x.com")) return "twitter";
  if (url.includes("linkedin.com")) return "linkedin";
  if (url.includes("tiktok.com")) return "tiktok";
  return null;
}

function rgbToHex(rgb: string): string | null {
  // Already hex?
  if (rgb.startsWith("#")) return rgb;
  const match = rgb.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!match) return null;
  const [, r, g, b] = match.map(Number);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function isFoodVertical(businessType?: string, businessName?: string): boolean {
  const combined = `${businessType ?? ""} ${businessName ?? ""}`.toLowerCase();
  const foodKeywords = ["restaurant", "cafe", "coffee", "pizza", "burger", "food", "kitchen", "bistro", "grill", "takeaway", "bakery", "pub", "bar"];
  return foodKeywords.some((k) => combined.includes(k));
}

// ---------------------------------------------------------------------------
// Main Agent Handler
// ---------------------------------------------------------------------------

export const leadProfilerAgent: AgentHandler = async (input) => {
  const upstream = input.upstreamArtifacts as Record<string, { leads?: LeadToProfile[] }>;
  const leads: LeadToProfile[] = [];

  for (const nodeOutput of Object.values(upstream)) {
    if (nodeOutput?.leads) leads.push(...nodeOutput.leads);
  }

  if (leads.length === 0) {
    return {
      summary: "No leads to profile.",
      artifacts: { profiles: [], profiled_count: 0 },
    };
  }

  const profiles: ProfileResult[] = [];

  for (const lead of leads) {
    const leadId = lead.lead_id ?? `lead-${Date.now()}`;
    ensureLeadDir(leadId);

    const profile: ProfileResult = {
      lead_id: leadId,
      business_name: lead.business_name,
      business_type: lead.business_type,
      google_rating: lead.google_rating ?? null,
      google_review_count: lead.google_review_count ?? null,
      address: lead.address,
      phone: lead.phone,
      email: lead.email,
      has_ssl: 0,
      is_mobile_friendly: 0,
      has_social_links: 0,
      social_links_json: "[]",
      website_tech_stack: "[]",
      website_quality_score: 0,
      pain_points_json: "[]",
      profiled_at: new Date().toISOString(),
      brand_colours_json: "{}",
      brand_fonts_json: "[]",
      brand_assets_json: "{}",
      social_profiles_json: "[]",
      services_extracted_json: "[]",
    };

    if (!lead.website_url) {
      // No website — highest opportunity
      const fallback = await profileWithFetch(lead);
      Object.assign(profile, fallback);
      profile.profiled_at = new Date().toISOString();
      profiles.push(profile);
      continue;
    }

    // Try Playwright first, fall back to fetch
    const scrapeResult = await scrapeWebsiteWithPlaywright(lead.website_url, leadId);

    if (scrapeResult) {
      // Playwright succeeded — rich data
      profile.has_ssl = scrapeResult.has_ssl;
      profile.is_mobile_friendly = scrapeResult.is_mobile_friendly;
      profile.has_social_links = scrapeResult.social_links.length > 0 ? 1 : 0;
      profile.social_links_json = JSON.stringify(scrapeResult.social_links);
      profile.website_tech_stack = JSON.stringify(scrapeResult.tech_stack);
      profile.website_quality_score = scrapeResult.quality_score;
      profile.pain_points_json = JSON.stringify(scrapeResult.pain_points);
      profile.brand_colours_json = JSON.stringify(scrapeResult.colours);
      profile.brand_fonts_json = JSON.stringify(scrapeResult.fonts);
      profile.screenshot_path = scrapeResult.screenshot_path;
      profile.logo_path = scrapeResult.logo_path;
      profile.business_description_raw = scrapeResult.description;
      profile.services_extracted_json = JSON.stringify(scrapeResult.services);

      profile.brand_assets_json = JSON.stringify({
        screenshot: scrapeResult.screenshot_path,
        logo: scrapeResult.logo_path,
        hero_images: scrapeResult.hero_images,
      });

      // Scrape social profiles
      if (scrapeResult.social_links.length > 0) {
        const socialProfiles = await scrapeSocialProfiles(scrapeResult.social_links, leadId);
        profile.social_profiles_json = JSON.stringify(socialProfiles);
      }

      // Extract menu for food businesses
      if (isFoodVertical(lead.business_type, lead.business_name)) {
        const menuItems = await extractMenuFromUrl(lead.website_url, leadId);
        if (menuItems.length > 0) {
          profile.menu_items_json = JSON.stringify(menuItems);
        }
      }
    } else {
      // Playwright unavailable or failed — use fetch fallback
      const fallback = await profileWithFetch(lead);
      Object.assign(profile, fallback);
    }

    profile.profiled_at = new Date().toISOString();
    profiles.push(profile);
  }

  return {
    summary: `Profiled ${profiles.length} leads. ${profiles.filter((p) => p.website_quality_score < 40).length} have poor/no websites. ${profiles.filter((p) => p.logo_path).length} logos scraped.`,
    artifacts: {
      profiles,
      profiled_count: profiles.length,
      high_opportunity_count: profiles.filter((p) => p.website_quality_score < 40).length,
    },
  };
};
