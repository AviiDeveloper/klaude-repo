/**
 * Design System — the "design brain" for site generation agents.
 *
 * Takes scraped brand data and makes intelligent design decisions:
 *  - Colour harmony (complementary, analogous, split-complementary)
 *  - Typography pairing (heading + body font combinations)
 *  - Layout selection based on available assets
 *  - Component density and section ordering
 *  - Accessibility (contrast ratios, readable text sizes)
 *  - Visual weight distribution
 *
 * The composer agent consults this instead of hard-coding design choices.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DesignDecision {
  // Colour palette (6 colours — fully resolved)
  colours: ResolvedPalette;
  // Typography
  fonts: ResolvedFonts;
  // Layout strategy
  layout: LayoutStrategy;
  // Section ordering
  sections: SectionConfig[];
  // Hero variant
  hero: HeroConfig;
  // Component style variant
  componentStyle: ComponentStyle;
  // CSS custom properties to inject
  cssVars: Record<string, string>;
  // Design rationale (for debug/preview)
  rationale: string[];
}

export interface ResolvedPalette {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  textOnPrimary: string;
  border: string;
  shadow: string;
  gradient: string;
  source: "scraped" | "logo" | "vertical_default" | "generated";
}

export interface ResolvedFonts {
  heading: string;
  headingWeight: string;
  headingImport: string;
  body: string;
  bodyWeight: string;
  bodyImport: string;
  mono?: string;
  scale: "compact" | "normal" | "large";
}

export interface LayoutStrategy {
  maxWidth: string;
  sectionSpacing: "tight" | "normal" | "airy";
  gridColumns: number;
  heroHeight: "compact" | "standard" | "tall" | "fullscreen";
  cornerRadius: "none" | "subtle" | "rounded" | "pill";
  shadowDepth: "flat" | "subtle" | "medium" | "deep";
}

export interface SectionConfig {
  id: string;
  enabled: boolean;
  order: number;
  variant: string;
  altBackground: boolean;
}

export interface HeroConfig {
  variant: "gradient" | "image_overlay" | "split_image" | "minimal" | "video_bg" | "pattern";
  overlayOpacity: number;
  textAlign: "left" | "center";
  showRating: boolean;
  showTrustBadges: boolean;
  ctaStyle: "solid" | "outline" | "dual";
}

export type ComponentStyle = "clean" | "card" | "bordered" | "glassmorphism" | "minimal" | "bold";

// ---------------------------------------------------------------------------
// Input from brand analyser
// ---------------------------------------------------------------------------

export interface DesignInput {
  vertical: string;
  businessName: string;
  businessType: string;
  // From brand analyser
  scrapedPrimary?: string;
  scrapedSecondary?: string;
  scrapedAccent?: string;
  scrapedFonts?: string[];
  paletteSource?: string;
  // Available assets
  hasLogo: boolean;
  hasHeroImage: boolean;
  hasGallery: boolean;
  galleryCount: number;
  hasReviews: boolean;
  reviewCount: number;
  hasHours: boolean;
  hasMap: boolean;
  hasMenu: boolean;
  hasSocialImages: boolean;
  socialImageCount: number;
  // Lead data
  googleRating?: number;
  googleReviewCount?: number;
}

// ---------------------------------------------------------------------------
// Colour theory utilities
// ---------------------------------------------------------------------------

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }

  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;

  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.max(0, Math.min(255, Math.round(255 * color))).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** Darken a hex colour by a percentage */
function darken(hex: string, amount: number): string {
  const [h, s, l] = hexToHsl(hex);
  return hslToHex(h, s, Math.max(0, l - amount));
}

/** Lighten a hex colour */
function lighten(hex: string, amount: number): string {
  const [h, s, l] = hexToHsl(hex);
  return hslToHex(h, s, Math.min(100, l + amount));
}

/** Generate complementary colour (180° opposite) */
function complementary(hex: string): string {
  const [h, s, l] = hexToHsl(hex);
  return hslToHex((h + 180) % 360, s, l);
}

/** Generate analogous colours (30° either side) */
function analogous(hex: string): [string, string] {
  const [h, s, l] = hexToHsl(hex);
  return [hslToHex((h + 30) % 360, s, l), hslToHex((h - 30 + 360) % 360, s, l)];
}

/** Generate split-complementary (150° and 210° from base) */
function splitComplementary(hex: string): [string, string] {
  const [h, s, l] = hexToHsl(hex);
  return [hslToHex((h + 150) % 360, s, l), hslToHex((h + 210) % 360, s, l)];
}

/** Check contrast ratio (WCAG) between two hex colours */
function contrastRatio(hex1: string, hex2: string): number {
  const luminance = (hex: string): number => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  };
  const l1 = luminance(hex1);
  const l2 = luminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Ensure text is readable on a given background */
function ensureReadable(textHex: string, bgHex: string, minRatio = 4.5): string {
  if (contrastRatio(textHex, bgHex) >= minRatio) return textHex;
  // Try darkening/lightening
  const [, , bgL] = hexToHsl(bgHex);
  if (bgL > 50) {
    // Light background — darken text
    let adjusted = textHex;
    for (let i = 5; i <= 40; i += 5) {
      adjusted = darken(textHex, i);
      if (contrastRatio(adjusted, bgHex) >= minRatio) return adjusted;
    }
    return "#1a1a2e"; // fallback dark
  } else {
    // Dark background — lighten text
    let adjusted = textHex;
    for (let i = 5; i <= 40; i += 5) {
      adjusted = lighten(textHex, i);
      if (contrastRatio(adjusted, bgHex) >= minRatio) return adjusted;
    }
    return "#ffffff"; // fallback white
  }
}

/** Generate a CSS gradient from primary colour */
function generateGradient(primary: string, secondary: string, angle = 135): string {
  return `linear-gradient(${angle}deg, ${primary}, ${secondary})`;
}

/** Convert hex colour to rgba with alpha (avoids broken hex+alpha strings) */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ---------------------------------------------------------------------------
// Typography pairing database
// ---------------------------------------------------------------------------

interface FontPairing {
  heading: string;
  headingWeight: string;
  headingImport: string;
  body: string;
  bodyWeight: string;
  bodyImport: string;
  mood: string[];
  verticals: string[];
}

const FONT_PAIRINGS: FontPairing[] = [
  // Bold & Modern
  {
    heading: "Inter", headingWeight: "700;800;900", headingImport: "Inter:wght@700;800;900",
    body: "Inter", bodyWeight: "400;500;600", bodyImport: "Inter:wght@400;500;600",
    mood: ["modern", "clean", "tech"], verticals: ["trades", "professional", "retail", "general"],
  },
  // Elegant & Warm
  {
    heading: "Playfair Display", headingWeight: "600;700;800", headingImport: "Playfair+Display:wght@600;700;800",
    body: "Lato", bodyWeight: "400;500;700", bodyImport: "Lato:wght@400;500;700",
    mood: ["elegant", "warm", "premium"], verticals: ["food", "health", "professional"],
  },
  // Friendly & Approachable
  {
    heading: "DM Sans", headingWeight: "500;700;800", headingImport: "DM+Sans:wght@500;700;800",
    body: "DM Sans", bodyWeight: "400;500", bodyImport: "DM+Sans:wght@400;500",
    mood: ["friendly", "approachable", "soft"], verticals: ["health", "retail", "food"],
  },
  // Strong & Industrial
  {
    heading: "Montserrat", headingWeight: "600;700;800;900", headingImport: "Montserrat:wght@600;700;800;900",
    body: "Open Sans", bodyWeight: "400;500;600", bodyImport: "Open+Sans:wght@400;500;600",
    mood: ["strong", "bold", "industrial"], verticals: ["trades", "professional"],
  },
  // Refined & Luxe
  {
    heading: "Cormorant Garamond", headingWeight: "500;600;700", headingImport: "Cormorant+Garamond:wght@500;600;700",
    body: "Mulish", bodyWeight: "400;500;600", bodyImport: "Mulish:wght@400;500;600",
    mood: ["luxe", "refined", "upscale"], verticals: ["food", "health", "professional"],
  },
  // Geometric & Contemporary
  {
    heading: "Poppins", headingWeight: "600;700;800", headingImport: "Poppins:wght@600;700;800",
    body: "Source Sans 3", bodyWeight: "400;500;600", bodyImport: "Source+Sans+3:wght@400;500;600",
    mood: ["geometric", "contemporary", "youthful"], verticals: ["retail", "health", "trades"],
  },
  // Classic & Trustworthy
  {
    heading: "Merriweather", headingWeight: "700;900", headingImport: "Merriweather:wght@700;900",
    body: "Source Sans 3", bodyWeight: "400;600", bodyImport: "Source+Sans+3:wght@400;600",
    mood: ["classic", "trustworthy", "authoritative"], verticals: ["professional", "trades"],
  },
  // Playful & Creative
  {
    heading: "Space Grotesk", headingWeight: "500;700", headingImport: "Space+Grotesk:wght@500;700",
    body: "Inter", bodyWeight: "400;500", bodyImport: "Inter:wght@400;500",
    mood: ["creative", "modern", "playful"], verticals: ["retail", "food", "health"],
  },
];

/** Select a font pairing based on vertical, or match to scraped fonts */
function selectFontPairing(vertical: string, scrapedFonts?: string[]): FontPairing {
  // If we scraped fonts, try to find a pairing that includes them
  if (scrapedFonts && scrapedFonts.length > 0) {
    const scrapedHeading = scrapedFonts[0].split(",")[0].trim().replace(/['"]/g, "");
    const match = FONT_PAIRINGS.find((p) =>
      p.heading.toLowerCase() === scrapedHeading.toLowerCase()
    );
    if (match) return match;

    // If we can't match, use the scraped font as heading with a safe body pairing
    return {
      heading: scrapedHeading,
      headingWeight: "600;700;800",
      headingImport: `${scrapedHeading.replace(/\s+/g, "+")}:wght@600;700;800`,
      body: "Inter",
      bodyWeight: "400;500;600",
      bodyImport: "Inter:wght@400;500;600",
      mood: ["custom"],
      verticals: [vertical],
    };
  }

  // Filter pairings suitable for this vertical
  const suitable = FONT_PAIRINGS.filter((p) => p.verticals.includes(vertical));
  if (suitable.length === 0) return FONT_PAIRINGS[0];

  // Use business name hash to pick consistently but with variety
  return suitable[hashString(vertical + Date.now().toString().slice(-4)) % suitable.length];
}

// ---------------------------------------------------------------------------
// Vertical design profiles
// ---------------------------------------------------------------------------

interface VerticalProfile {
  defaultPrimary: string;
  defaultAccent: string;
  componentStyle: ComponentStyle;
  heroVariant: HeroConfig["variant"];
  heroTextAlign: "left" | "center";
  cornerRadius: LayoutStrategy["cornerRadius"];
  shadowDepth: LayoutStrategy["shadowDepth"];
  sectionSpacing: LayoutStrategy["sectionSpacing"];
  showTrustBadges: boolean;
  gradientAngle: number;
  mood: string;
}

const VERTICAL_PROFILES: Record<string, VerticalProfile> = {
  trades: {
    defaultPrimary: "#2563eb",
    defaultAccent: "#f59e0b",
    componentStyle: "bold",
    heroVariant: "gradient",
    heroTextAlign: "left",
    cornerRadius: "subtle",
    shadowDepth: "medium",
    sectionSpacing: "normal",
    showTrustBadges: true,
    gradientAngle: 135,
    mood: "trustworthy and professional",
  },
  food: {
    defaultPrimary: "#dc2626",
    defaultAccent: "#f59e0b",
    componentStyle: "card",
    heroVariant: "image_overlay",
    heroTextAlign: "center",
    cornerRadius: "rounded",
    shadowDepth: "subtle",
    sectionSpacing: "airy",
    showTrustBadges: false,
    gradientAngle: 180,
    mood: "warm and inviting",
  },
  health: {
    defaultPrimary: "#7c3aed",
    defaultAccent: "#a78bfa",
    componentStyle: "glassmorphism",
    heroVariant: "split_image",
    heroTextAlign: "left",
    cornerRadius: "rounded",
    shadowDepth: "subtle",
    sectionSpacing: "airy",
    showTrustBadges: false,
    gradientAngle: 160,
    mood: "calm and premium",
  },
  professional: {
    defaultPrimary: "#0f766e",
    defaultAccent: "#2dd4bf",
    componentStyle: "clean",
    heroVariant: "minimal",
    heroTextAlign: "left",
    cornerRadius: "subtle",
    shadowDepth: "flat",
    sectionSpacing: "normal",
    showTrustBadges: true,
    gradientAngle: 135,
    mood: "authoritative and trustworthy",
  },
  retail: {
    defaultPrimary: "#ea580c",
    defaultAccent: "#fbbf24",
    componentStyle: "card",
    heroVariant: "gradient",
    heroTextAlign: "center",
    cornerRadius: "rounded",
    shadowDepth: "medium",
    sectionSpacing: "normal",
    showTrustBadges: false,
    gradientAngle: 135,
    mood: "vibrant and welcoming",
  },
};

// ---------------------------------------------------------------------------
// Main design decision engine
// ---------------------------------------------------------------------------

export function makeDesignDecision(input: DesignInput): DesignDecision {
  const profile = VERTICAL_PROFILES[input.vertical] ?? VERTICAL_PROFILES.trades;
  const rationale: string[] = [];

  // ---------------------------------------------------------------
  // 1. COLOUR PALETTE
  // ---------------------------------------------------------------
  const primary = input.scrapedPrimary ?? profile.defaultPrimary;
  const paletteSource: ResolvedPalette["source"] = input.scrapedPrimary
    ? (input.paletteSource === "scraped_css" ? "scraped" : "logo")
    : "vertical_default";

  rationale.push(`Primary colour: ${primary} (${paletteSource})`);

  // Generate harmonious secondary if not scraped
  let secondary: string;
  if (input.scrapedSecondary && input.scrapedSecondary !== primary) {
    secondary = input.scrapedSecondary;
    rationale.push(`Secondary: ${secondary} (scraped)`);
  } else {
    // Use analogous colour for harmony
    const [analog1] = analogous(primary);
    secondary = darken(analog1, 10);
    rationale.push(`Secondary: ${secondary} (analogous harmony)`);
  }

  // Accent — should contrast with primary
  let accent: string;
  if (input.scrapedAccent && input.scrapedAccent !== primary) {
    accent = input.scrapedAccent;
  } else {
    // Split-complementary for visual pop
    const [split1] = splitComplementary(primary);
    accent = split1;
    rationale.push(`Accent: ${accent} (split-complementary)`);
  }

  // Derived colours
  const primaryDark = darken(primary, 15);
  const primaryLight = lighten(primary, 35);
  const background = "#ffffff";
  const surface = "#f8fafc";
  const text = ensureReadable("#1e293b", background);
  const textMuted = ensureReadable("#64748b", background, 3);
  const textOnPrimary = ensureReadable("#ffffff", primary);
  const border = "#e2e8f0";
  // Shadow colour: primary at 8% opacity (use rgba instead of hex+alpha for compatibility)
  const [shR, shG, shB] = [parseInt(primary.slice(1, 3), 16), parseInt(primary.slice(3, 5), 16), parseInt(primary.slice(5, 7), 16)];
  const shadow = `rgba(${shR},${shG},${shB},0.08)`;
  const gradient = generateGradient(primary, secondary, profile.gradientAngle);

  const colours: ResolvedPalette = {
    primary, primaryDark, primaryLight, secondary, accent,
    background, surface, text, textMuted, textOnPrimary,
    border, shadow, gradient, source: paletteSource,
  };

  // ---------------------------------------------------------------
  // 2. TYPOGRAPHY
  // ---------------------------------------------------------------
  const fontPairing = selectFontPairing(input.vertical, input.scrapedFonts);

  // Scale based on vertical
  let scale: ResolvedFonts["scale"] = "normal";
  if (input.vertical === "food" || input.vertical === "health") scale = "large";
  if (input.vertical === "professional") scale = "compact";

  const fonts: ResolvedFonts = {
    heading: fontPairing.heading,
    headingWeight: fontPairing.headingWeight,
    headingImport: fontPairing.headingImport,
    body: fontPairing.body,
    bodyWeight: fontPairing.bodyWeight,
    bodyImport: fontPairing.bodyImport,
    scale,
  };

  rationale.push(`Fonts: ${fonts.heading} / ${fonts.body} (${fontPairing.mood.join(", ")})`);

  // ---------------------------------------------------------------
  // 3. LAYOUT STRATEGY
  // ---------------------------------------------------------------
  const hasRichContent = input.hasGallery || input.hasMenu || input.hasReviews;

  const layout: LayoutStrategy = {
    maxWidth: hasRichContent ? "1200px" : "1100px",
    sectionSpacing: profile.sectionSpacing,
    gridColumns: input.galleryCount >= 6 ? 3 : input.galleryCount >= 3 ? 3 : 2,
    heroHeight: input.hasHeroImage ? "tall" : (input.vertical === "food" ? "tall" : "standard"),
    cornerRadius: profile.cornerRadius,
    shadowDepth: profile.shadowDepth,
  };

  // ---------------------------------------------------------------
  // 4. HERO CONFIGURATION
  // ---------------------------------------------------------------
  let heroVariant = profile.heroVariant;
  // Override based on available assets
  if (input.hasHeroImage && heroVariant === "gradient") heroVariant = "image_overlay";
  if (input.hasHeroImage && input.vertical === "health") heroVariant = "split_image";
  if (!input.hasHeroImage && heroVariant === "image_overlay") heroVariant = "gradient";
  if (!input.hasHeroImage && heroVariant === "split_image") heroVariant = "gradient";

  const hasGoodRating = (input.googleRating ?? 0) >= 4.0 && (input.googleReviewCount ?? 0) > 5;

  const hero: HeroConfig = {
    variant: heroVariant,
    overlayOpacity: heroVariant === "image_overlay" ? 0.5 : 0,
    textAlign: profile.heroTextAlign,
    showRating: hasGoodRating,
    showTrustBadges: profile.showTrustBadges,
    ctaStyle: input.hasHeroImage ? "solid" : "dual",
  };

  rationale.push(`Hero: ${heroVariant} (${input.hasHeroImage ? "has image" : "no image"})`);

  // ---------------------------------------------------------------
  // 5. SECTION ORDERING & ENABLEMENT
  // ---------------------------------------------------------------
  const sectionDefs: Array<{ id: string; enabled: boolean; priority: number; alt: boolean }> = [
    { id: "services", enabled: true, priority: 10, alt: false },
    { id: "gallery", enabled: input.hasGallery, priority: 20, alt: true },
    { id: "menu", enabled: input.hasMenu, priority: 15, alt: true },
    { id: "reviews", enabled: input.hasReviews, priority: 25, alt: true },
    { id: "about", enabled: true, priority: 30, alt: false },
    { id: "hours", enabled: input.hasHours, priority: 35, alt: true },
    { id: "cta", enabled: true, priority: 40, alt: false },
    { id: "contact", enabled: true, priority: 45, alt: true },
    { id: "map", enabled: input.hasMap, priority: 50, alt: false },
  ];

  // Food vertical: prioritise menu
  if (input.vertical === "food" && input.hasMenu) {
    const menuDef = sectionDefs.find((s) => s.id === "menu");
    if (menuDef) menuDef.priority = 8; // before services
  }

  // If we have great reviews, bump them up
  if (input.hasReviews && input.reviewCount >= 3) {
    const reviewDef = sectionDefs.find((s) => s.id === "reviews");
    if (reviewDef) reviewDef.priority = 12; // right after services
  }

  const sections: SectionConfig[] = sectionDefs
    .filter((s) => s.enabled)
    .sort((a, b) => a.priority - b.priority)
    .map((s, i) => ({
      id: s.id,
      enabled: s.enabled,
      order: i,
      variant: "default",
      altBackground: s.alt && i % 2 === 1,
    }));

  const enabledCount = sections.filter((s) => s.enabled).length;
  rationale.push(`Sections: ${enabledCount} enabled, ordered by priority`);

  // ---------------------------------------------------------------
  // 6. COMPONENT STYLE
  // ---------------------------------------------------------------
  let componentStyle = profile.componentStyle;

  // Upgrade to glassmorphism if we have good imagery
  if (input.hasHeroImage && input.hasGallery && componentStyle === "card") {
    componentStyle = "glassmorphism";
    rationale.push("Component style upgraded to glassmorphism (rich imagery available)");
  }

  // ---------------------------------------------------------------
  // 7. CSS CUSTOM PROPERTIES
  // ---------------------------------------------------------------
  const radiusMap = { none: "0", subtle: "8px", rounded: "12px", pill: "50px" };
  const shadowMap = {
    flat: "none",
    subtle: `0 1px 3px ${shadow}`,
    medium: `0 4px 14px ${shadow}`,
    deep: `0 8px 30px ${shadow}`,
  };

  const fontSizeScale = scale === "large"
    ? { h1: "3.2rem", h2: "2.2rem", h3: "1.3rem", body: "1.05rem", small: "0.9rem" }
    : scale === "compact"
    ? { h1: "2.6rem", h2: "1.8rem", h3: "1.1rem", body: "0.95rem", small: "0.85rem" }
    : { h1: "3rem", h2: "2rem", h3: "1.2rem", body: "1rem", small: "0.875rem" };

  const spacingScale = layout.sectionSpacing === "airy"
    ? { section: "96px", gap: "32px", card: "32px" }
    : layout.sectionSpacing === "tight"
    ? { section: "56px", gap: "16px", card: "20px" }
    : { section: "80px", gap: "24px", card: "28px" };

  const cssVars: Record<string, string> = {
    "--color-primary": colours.primary,
    "--color-primary-dark": colours.primaryDark,
    "--color-primary-light": colours.primaryLight,
    "--color-secondary": colours.secondary,
    "--color-accent": colours.accent,
    "--color-bg": colours.background,
    "--color-surface": colours.surface,
    "--color-text": colours.text,
    "--color-text-muted": colours.textMuted,
    "--color-text-on-primary": colours.textOnPrimary,
    "--color-border": colours.border,
    "--gradient": colours.gradient,
    "--shadow": shadowMap[layout.shadowDepth],
    "--shadow-hover": shadowMap[layout.shadowDepth === "flat" ? "subtle" : "deep"],
    "--radius": radiusMap[layout.cornerRadius],
    "--radius-lg": radiusMap[layout.cornerRadius === "none" ? "none" : "rounded"],
    "--font-heading": `'${fonts.heading}', -apple-system, BlinkMacSystemFont, sans-serif`,
    "--font-body": `'${fonts.body}', -apple-system, BlinkMacSystemFont, sans-serif`,
    "--font-h1": fontSizeScale.h1,
    "--font-h2": fontSizeScale.h2,
    "--font-h3": fontSizeScale.h3,
    "--font-body-size": fontSizeScale.body,
    "--font-small": fontSizeScale.small,
    "--spacing-section": spacingScale.section,
    "--spacing-gap": spacingScale.gap,
    "--spacing-card": spacingScale.card,
    "--max-width": layout.maxWidth,
    "--hero-overlay": `rgba(0,0,0,${hero.overlayOpacity})`,
  };

  rationale.push(`Style: ${componentStyle}, radius: ${layout.cornerRadius}, shadow: ${layout.shadowDepth}`);

  return {
    colours,
    fonts,
    layout,
    sections,
    hero,
    componentStyle,
    cssVars,
    rationale,
  };
}

// ---------------------------------------------------------------------------
// CSS generator — creates the full stylesheet from design decisions
// ---------------------------------------------------------------------------

export function generateCss(design: DesignDecision): string {
  const { colours, fonts, hero, componentStyle, cssVars } = design;

  const vars = Object.entries(cssVars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n");

  // Component style-specific CSS
  const cardCss = componentStyle === "glassmorphism" ? `
    .card, .service-card, .testimonial-card {
      background: rgba(255,255,255,0.7);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255,255,255,0.3);
    }
  ` : componentStyle === "bordered" ? `
    .card, .service-card, .testimonial-card {
      background: var(--color-bg);
      border: 2px solid var(--color-border);
    }
  ` : componentStyle === "bold" ? `
    .card, .service-card, .testimonial-card {
      background: var(--color-bg);
      box-shadow: var(--shadow);
      border-top: 4px solid var(--color-primary);
    }
    .card:hover, .service-card:hover { border-top-color: var(--color-accent); }
  ` : componentStyle === "minimal" ? `
    .card, .service-card, .testimonial-card {
      background: transparent;
      border-bottom: 1px solid var(--color-border);
      border-radius: 0;
      padding-left: 0; padding-right: 0;
    }
  ` : `
    .card, .service-card, .testimonial-card {
      background: var(--color-bg);
      box-shadow: var(--shadow);
      border-radius: var(--radius);
    }
    .card:hover, .service-card:hover { box-shadow: var(--shadow-hover); transform: translateY(-4px); }
  `;

  // Hero variant CSS
  let heroCss = "";
  switch (hero.variant) {
    case "gradient":
      heroCss = `
        .hero { background: ${colours.gradient}; color: var(--color-text-on-primary); padding: var(--spacing-section) 0; }
        .hero .btn-primary { background: #fff; color: var(--color-primary); }
      `;
      break;
    case "image_overlay":
      heroCss = `
        .hero { background-size: cover; background-position: center; position: relative; padding: var(--spacing-section) 0; color: #fff; }
        .hero::before { content: ''; position: absolute; inset: 0; background: linear-gradient(to bottom, ${hexToRgba(colours.primary, 0.8)}, rgba(0,0,0,0.7)); }
        .hero .container { position: relative; z-index: 1; }
        .hero .btn-primary { background: #fff; color: var(--color-primary); }
      `;
      break;
    case "split_image":
      heroCss = `
        .hero { padding: var(--spacing-section) 0; background: linear-gradient(160deg, ${hexToRgba(colours.primaryLight, 0.13)} 0%, ${colours.surface} 100%); }
        .hero-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: center; }
        .hero-image-col img { border-radius: var(--radius-lg); box-shadow: 0 20px 60px rgba(0,0,0,0.1); max-height: 420px; width: 100%; object-fit: cover; }
        @media (max-width: 768px) { .hero-two-col { grid-template-columns: 1fr; } .hero-image-col { order: -1; } }
      `;
      break;
    case "minimal":
      heroCss = `
        .hero { padding: var(--spacing-section) 0; background: var(--color-bg); border-bottom: 1px solid var(--color-border); }
      `;
      break;
    default:
      heroCss = `
        .hero { padding: var(--spacing-section) 0; background: ${colours.gradient}; color: var(--color-text-on-primary); }
      `;
  }

  return `
@import url('https://fonts.googleapis.com/css2?family=${fonts.headingImport}&family=${fonts.bodyImport}&display=swap');

:root {
${vars}
}

*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  font-family: var(--font-body); color: var(--color-text);
  line-height: 1.7; -webkit-font-smoothing: antialiased;
  font-size: var(--font-body-size);
}
h1, h2, h3, h4 { font-family: var(--font-heading); line-height: 1.25; }
h1 { font-size: var(--font-h1); }
h2 { font-size: var(--font-h2); }
h3 { font-size: var(--font-h3); }
img { max-width: 100%; height: auto; }
a { color: inherit; text-decoration: none; }
.container { max-width: var(--max-width); margin: 0 auto; padding: 0 24px; }

/* Buttons */
.btn {
  display: inline-block; padding: 14px 32px; border-radius: var(--radius);
  font-weight: 600; font-size: 1rem; cursor: pointer;
  transition: all 0.3s ease; border: none; text-align: center;
  font-family: var(--font-body);
}
.btn-primary { background: var(--color-primary); color: var(--color-text-on-primary); box-shadow: 0 4px 14px ${hexToRgba(colours.primary, 0.25)}; }
.btn-primary:hover { transform: translateY(-2px); box-shadow: 0 6px 20px ${hexToRgba(colours.primary, 0.38)}; }
.btn-outline { border: 2px solid var(--color-primary); color: var(--color-primary); background: transparent; }
.btn-outline:hover { background: var(--color-primary); color: var(--color-text-on-primary); }
.btn-white { background: #fff; color: var(--color-primary); box-shadow: 0 4px 14px rgba(0,0,0,0.15); }
.btn-white:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.2); }

/* Sections */
.section { padding: var(--spacing-section) 0; }
.section-alt { background: var(--color-surface); }
.section-title { font-size: var(--font-h2); text-align: center; margin-bottom: 12px; }
.section-subtitle { text-align: center; color: var(--color-text-muted); font-size: 1.1rem; margin-bottom: 48px; max-width: 600px; margin-left: auto; margin-right: auto; }

/* Fade-in */
.fade-in { opacity: 0; transform: translateY(24px); transition: opacity 0.7s ease, transform 0.7s ease; }
.fade-in.visible { opacity: 1; transform: translateY(0); }

/* Header */
.header {
  padding: 16px 0; position: sticky; top: 0; z-index: 100;
  backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
  background: rgba(255,255,255,0.92); border-bottom: 1px solid var(--color-border);
}
.header .container { display: flex; justify-content: space-between; align-items: center; }
.logo { display: flex; align-items: center; gap: 12px; font-size: 1.4rem; font-weight: 800; color: var(--color-primary); }
.logo-img { max-height: 44px; width: auto; object-fit: contain; }
.nav-links { display: flex; gap: 24px; align-items: center; }
.nav-links a { font-weight: 500; color: var(--color-text-muted); transition: color 0.2s; }
.nav-links a:hover { color: var(--color-primary); }
.header-cta { padding: 10px 24px; font-size: 0.9rem; border-radius: var(--radius); }

/* Rating badge */
.rating-badge {
  display: inline-flex; align-items: center; gap: 8px;
  background: rgba(255,255,255,0.95); padding: 8px 18px; border-radius: 50px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08); font-weight: 600; font-size: 0.95rem; color: #1a1a2e;
  margin-bottom: 20px;
}
.rating-stars { color: #f59e0b; letter-spacing: 2px; }

/* Hero */
${heroCss}
.hero-content { max-width: 600px; ${hero.textAlign === "center" ? "margin: 0 auto; text-align: center;" : ""} }
.hero-title { font-size: var(--font-h1); font-weight: 900; margin-bottom: 20px; line-height: 1.1; }
.hero-desc { font-size: 1.2rem; opacity: 0.9; margin-bottom: 32px; line-height: 1.6; }
.hero-buttons { display: flex; gap: 16px; flex-wrap: wrap; ${hero.textAlign === "center" ? "justify-content: center;" : ""} }
.hero-trust { display: flex; gap: 24px; margin-top: 40px; flex-wrap: wrap; }
.trust-item { display: flex; align-items: center; gap: 8px; font-size: 0.95rem; opacity: 0.85; }
.trust-check { color: #4ade80; font-weight: 700; }

/* Services */
.services-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: var(--spacing-gap); }
.service-card {
  border-radius: var(--radius); padding: var(--spacing-card);
  text-align: center; transition: all 0.3s ease;
}
.service-card h3 { margin-bottom: 8px; color: var(--color-primary); }
.service-card p { color: var(--color-text-muted); font-size: var(--font-small); }

/* Gallery */
.gallery-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
.gallery-item { border-radius: var(--radius); overflow: hidden; aspect-ratio: 4/3; box-shadow: var(--shadow); transition: transform 0.3s ease; }
.gallery-item:hover { transform: scale(1.03); }
.gallery-item img { width: 100%; height: 100%; object-fit: cover; }

/* Testimonials */
.testimonials-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: var(--spacing-gap); }
.testimonial-card {
  border-radius: var(--radius); padding: var(--spacing-card);
  position: relative;
}
.testimonial-card::before {
  content: '\\201C'; position: absolute; top: 8px; left: 16px;
  font-size: 3.5rem; color: ${hexToRgba(colours.primary, 0.1)}; font-family: Georgia, serif; line-height: 1;
}
.testimonial-text { font-size: 1rem; color: var(--color-text-muted); margin-bottom: 16px; font-style: italic; padding-top: 16px; }
.testimonial-author { font-weight: 700; font-size: 0.9rem; color: var(--color-text); }
.testimonial-rating { color: #f59e0b; font-size: 0.85rem; margin-top: 4px; }

/* Map */
.map-section iframe { width: 100%; height: 350px; border: 0; display: block; }

/* Opening hours */
.hours-grid { max-width: 500px; margin: 0 auto; }
.hours-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--color-border); }
.hours-day { font-weight: 600; }
.hours-time { color: var(--color-text-muted); }

/* Menu */
.menu-list { max-width: 700px; margin: 0 auto; }
.menu-item { display: flex; justify-content: space-between; align-items: baseline; padding: 14px 0; border-bottom: 1px dashed var(--color-border); }
.menu-item-name { font-weight: 600; font-size: 1.05rem; }
.menu-item-price { color: var(--color-primary); font-weight: 700; font-size: 1.1rem; }
.menu-item-desc { font-size: var(--font-small); color: var(--color-text-muted); }

/* Contact */
.contact-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 32px; text-align: center; }
.contact-item { padding: 24px; border-radius: var(--radius); }
.contact-icon { font-size: 1.5rem; margin-bottom: 8px; }
.contact-label { font-weight: 700; color: var(--color-primary); margin-bottom: 4px; display: block; }
.contact-value { color: var(--color-text-muted); }
.contact-value a { color: var(--color-primary); font-weight: 500; }

/* CTA */
.cta-section { padding: var(--spacing-section) 0; text-align: center; background: ${colours.gradient}; color: var(--color-text-on-primary); }
.cta-section h2 { font-size: 2.2rem; margin-bottom: 16px; }
.cta-section p { font-size: 1.15rem; margin-bottom: 32px; opacity: 0.9; max-width: 500px; margin-left: auto; margin-right: auto; }

/* Footer */
.footer { padding: 32px 0; background: #0f172a; color: #94a3b8; text-align: center; font-size: var(--font-small); }
.footer a { color: #60a5fa; }

${cardCss}

/* Responsive */
@media (max-width: 768px) {
  :root { --font-h1: 2.2rem; --font-h2: 1.6rem; --spacing-section: 56px; }
  .nav-links { display: none; }
  .gallery-grid { grid-template-columns: 1fr 1fr; }
  .testimonials-grid { grid-template-columns: 1fr; }
}
@media (max-width: 480px) {
  .gallery-grid { grid-template-columns: 1fr; }
  .contact-grid { grid-template-columns: 1fr; }
  .hero-buttons { flex-direction: column; }
}
`;
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}
