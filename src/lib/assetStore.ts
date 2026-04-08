/**
 * Asset Store — local filesystem storage for lead brand assets.
 *
 * Assets are stored at:  {PROJECTS_BASE}/.assets/{lead_id}/
 * A manifest.json in each directory tracks metadata.
 *
 * Served via existing /api/files/download?relativePath=.assets/{lead_id}/{file}&raw=true
 */

import { mkdirSync, existsSync, writeFileSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { homedir } from "node:os";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AssetCategory =
  | "logo"
  | "screenshot"
  | "social"
  | "hero"
  | "gallery"
  | "menu"
  | "location"
  | "team"
  | "product"
  | "favicon";

export interface AssetMetadata {
  lead_id: string;
  filename: string;
  category: AssetCategory;
  source_url?: string;
  width?: number;
  height?: number;
  size_bytes?: number;
  mime_type?: string;
  created_at: string;
}

export interface AssetManifest {
  lead_id: string;
  assets: AssetMetadata[];
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const PROJECTS_BASE = process.env.PROJECTS_PATH ?? join(homedir(), "projects");
const ASSETS_ROOT = join(PROJECTS_BASE, ".assets");

export function getLeadDir(leadId: string): string {
  return join(ASSETS_ROOT, leadId);
}

export function ensureLeadDir(leadId: string): string {
  const dir = getLeadDir(leadId);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export function getAssetPath(leadId: string, filename: string): string {
  return join(getLeadDir(leadId), filename);
}

/** URL path served by the Mission Control file download API */
export function buildAssetUrl(leadId: string, filename: string): string {
  return `/api/files/download?relativePath=.assets/${encodeURIComponent(leadId)}/${encodeURIComponent(filename)}&raw=true`;
}

// ---------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------

function manifestPath(leadId: string): string {
  return join(getLeadDir(leadId), "manifest.json");
}

export function getManifest(leadId: string): AssetManifest {
  const p = manifestPath(leadId);
  if (existsSync(p)) {
    try {
      return JSON.parse(readFileSync(p, "utf-8")) as AssetManifest;
    } catch {
      /* corrupt — start fresh */
    }
  }
  return { lead_id: leadId, assets: [], updated_at: new Date().toISOString() };
}

export function writeManifest(leadId: string, manifest: AssetManifest): void {
  ensureLeadDir(leadId);
  manifest.updated_at = new Date().toISOString();
  writeFileSync(manifestPath(leadId), JSON.stringify(manifest, null, 2));
}

function addToManifest(leadId: string, meta: AssetMetadata): void {
  const manifest = getManifest(leadId);
  // Replace if same filename already exists
  manifest.assets = manifest.assets.filter((a) => a.filename !== meta.filename);
  manifest.assets.push(meta);
  writeManifest(leadId, manifest);
}

// ---------------------------------------------------------------------------
// Image processing helpers
// ---------------------------------------------------------------------------

/** Lazy-load sharp — it's an optional peer dep */
let _sharp: typeof import("sharp") | null | undefined;

async function getSharp(): Promise<typeof import("sharp") | null> {
  if (_sharp !== undefined) return _sharp;
  try {
    _sharp = (await import("sharp")).default as unknown as typeof import("sharp");
    return _sharp;
  } catch {
    _sharp = null;
    return null;
  }
}

/**
 * Resize image buffer to maxWidth (preserving aspect ratio).
 * Falls back to returning the original buffer if sharp is unavailable.
 */
export async function resizeImage(
  buffer: Buffer,
  maxWidth = 1200,
  format: "jpeg" | "png" = "jpeg",
): Promise<{ buffer: Buffer; width?: number; height?: number }> {
  const sharp = await getSharp();
  if (!sharp) return { buffer };

  try {
    const img = sharp(buffer);
    const metadata = await img.metadata();

    if (metadata.width && metadata.width > maxWidth) {
      const resized =
        format === "png"
          ? await img.resize(maxWidth).png().toBuffer()
          : await img.resize(maxWidth).jpeg({ quality: 80 }).toBuffer();
      const newMeta = await sharp(resized).metadata();
      return { buffer: resized, width: newMeta.width, height: newMeta.height };
    }

    return { buffer, width: metadata.width, height: metadata.height };
  } catch {
    return { buffer };
  }
}

// ---------------------------------------------------------------------------
// Mime type helper
// ---------------------------------------------------------------------------

function mimeFromExt(filename: string): string {
  const ext = extname(filename).toLowerCase();
  const map: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".pdf": "application/pdf",
    ".ico": "image/x-icon",
  };
  return map[ext] ?? "application/octet-stream";
}

// ---------------------------------------------------------------------------
// Save operations
// ---------------------------------------------------------------------------

export async function saveBuffer(
  leadId: string,
  filename: string,
  buffer: Buffer,
  category: AssetCategory,
  opts?: { sourceUrl?: string; resize?: boolean; format?: "jpeg" | "png" },
): Promise<AssetMetadata> {
  const dir = ensureLeadDir(leadId);

  let finalBuffer = buffer;
  let width: number | undefined;
  let height: number | undefined;

  const shouldResize = opts?.resize !== false;
  const isImage = /\.(png|jpe?g|gif|webp)$/i.test(filename);

  if (shouldResize && isImage) {
    const fmt = opts?.format ?? (filename.endsWith(".png") ? "png" : "jpeg");
    const result = await resizeImage(buffer, 1200, fmt);
    finalBuffer = result.buffer;
    width = result.width;
    height = result.height;
  }

  const filePath = join(dir, filename);
  writeFileSync(filePath, finalBuffer);

  const meta: AssetMetadata = {
    lead_id: leadId,
    filename,
    category,
    source_url: opts?.sourceUrl,
    width,
    height,
    size_bytes: finalBuffer.length,
    mime_type: mimeFromExt(filename),
    created_at: new Date().toISOString(),
  };

  addToManifest(leadId, meta);
  return meta;
}

export async function saveScreenshot(
  leadId: string,
  filename: string,
  buffer: Buffer,
): Promise<AssetMetadata> {
  return saveBuffer(leadId, filename, buffer, "screenshot", {
    resize: false,
    format: "png",
  });
}

/**
 * Download an image from a URL and save it locally.
 * Returns null on failure (network error, timeout, etc).
 */
export async function saveFromUrl(
  leadId: string,
  filename: string,
  url: string,
  category: AssetCategory,
  opts?: { timeout?: number },
): Promise<AssetMetadata | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts?.timeout ?? 15_000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; OpenClaw/1.0)" },
    });
    clearTimeout(timer);

    if (!res.ok) return null;

    const arrayBuf = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);

    if (buffer.length < 100) return null; // too small to be useful

    return saveBuffer(leadId, filename, buffer, category, { sourceUrl: url });
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Read operations
// ---------------------------------------------------------------------------

export function listAssets(leadId: string): AssetMetadata[] {
  return getManifest(leadId).assets;
}

export function assetExists(leadId: string, filename: string): boolean {
  return existsSync(getAssetPath(leadId, filename));
}

export function getAssetBuffer(leadId: string, filename: string): Buffer | null {
  const p = getAssetPath(leadId, filename);
  if (!existsSync(p)) return null;
  return readFileSync(p);
}

export function getAssetsByCategory(leadId: string, category: AssetCategory): AssetMetadata[] {
  return listAssets(leadId).filter((a) => a.category === category);
}

export function getTotalAssetSize(leadId: string): number {
  return listAssets(leadId).reduce((sum, a) => sum + (a.size_bytes ?? 0), 0);
}

// ---------------------------------------------------------------------------
// Colour extraction from logo (using sharp pixel sampling)
// ---------------------------------------------------------------------------

export interface DominantColours {
  primary: string;
  secondary: string;
  accent: string;
  source: "logo_analysis";
}

export interface BrandColourPalette {
  /** Top colours across ALL photos, ranked by frequency */
  colours: Array<{
    hex: string;
    frequency: number; // 0.0-1.0 (proportion of total pixels)
    sources: string[]; // which files contributed this colour
  }>;
  /** Suggested primary, secondary, accent based on cross-image analysis */
  suggested: { primary: string; secondary: string; accent: string };
  /** Total photos analysed */
  photos_analysed: number;
  source: "photo_analysis";
}

/**
 * Extract dominant colours from ALL photos for a lead.
 * Analyses Google photos, Instagram posts, website gallery, hero images.
 * Builds a frequency-weighted palette that represents the brand's visual identity.
 */
export async function extractBrandPalette(
  leadId: string,
  maxPhotos = 15,
): Promise<BrandColourPalette | null> {
  const sharp = await getSharp();
  if (!sharp) return null;

  const assets = listAssets(leadId);
  // Only analyse actual photos, not screenshots or menus
  const photos = assets.filter((a) =>
    a.category === "gallery" || a.category === "hero" || a.category === "social" || a.category === "logo" || a.category === "product",
  ).slice(0, maxPhotos);

  if (photos.length === 0) return null;

  // Global colour frequency counts across all images
  const globalCounts = new Map<string, { count: number; sources: Set<string> }>();
  let totalPixels = 0;
  let analysed = 0;

  for (const photo of photos) {
    const p = getAssetPath(leadId, photo.filename);
    if (!existsSync(p)) continue;

    try {
      const { data } = await sharp(readFileSync(p))
        .resize(40, 40, { fit: "cover" })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const pixelsInImage = data.length / 3;
      totalPixels += pixelsInImage;
      analysed++;

      for (let i = 0; i < data.length; i += 3) {
        // Quantise to 24-step buckets (finer than logo analysis)
        const r = Math.min(255, Math.round(data[i] / 24) * 24);
        const g = Math.min(255, Math.round(data[i + 1] / 24) * 24);
        const b = Math.min(255, Math.round(data[i + 2] / 24) * 24);

        const brightness = (r + g + b) / 3;
        // Skip very light and very dark (backgrounds, shadows)
        if (brightness > 220 || brightness < 30) continue;
        // Skip very low saturation (greys)
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        if (max - min < 20 && brightness > 60 && brightness < 200) continue;

        const key = `${r},${g},${b}`;
        const existing = globalCounts.get(key);
        if (existing) {
          existing.count++;
          existing.sources.add(photo.filename);
        } else {
          globalCounts.set(key, { count: 1, sources: new Set([photo.filename]) });
        }
      }
    } catch {
      // Skip unreadable images
    }
  }

  if (globalCounts.size === 0 || totalPixels === 0) return null;

  const toHex = (rgb: string): string => {
    const [r, g, b] = rgb.split(",").map(Number);
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  };

  // Sort by frequency, prefer colours that appear in multiple photos
  const sorted = [...globalCounts.entries()]
    .map(([key, val]) => ({
      key,
      count: val.count,
      sources: [...val.sources],
      multiSource: val.sources.size,
    }))
    // Weight: frequency × number of different photos it appears in
    .sort((a, b) => (b.count * b.multiSource) - (a.count * a.multiSource));

  const topColours = sorted.slice(0, 12).map((c) => ({
    hex: toHex(c.key),
    frequency: c.count / totalPixels,
    sources: c.sources,
  }));

  // Pick suggested colours — prefer ones that appear in many photos
  const primary = topColours[0]?.hex ?? "#333333";
  const secondary = topColours.length > 1 ? topColours[1].hex : primary;
  const accent = topColours.length > 2 ? topColours[2].hex : secondary;

  return {
    colours: topColours,
    suggested: { primary, secondary, accent },
    photos_analysed: analysed,
    source: "photo_analysis",
  };
}

/**
 * Extract dominant colours from a logo image.
 * Resizes to 50x50, samples raw pixels, clusters by frequency.
 * Returns hex codes. Falls back to null if sharp unavailable.
 */
export async function extractDominantColours(
  leadId: string,
  logoFilename = "logo.png",
): Promise<DominantColours | null> {
  const sharp = await getSharp();
  if (!sharp) return null;

  const p = getAssetPath(leadId, logoFilename);
  if (!existsSync(p)) return null;

  try {
    const { data, info } = await sharp(readFileSync(p))
      .resize(50, 50, { fit: "cover" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Count colour frequencies (quantise to 16-step buckets)
    const counts = new Map<string, number>();
    for (let i = 0; i < data.length; i += 3) {
      const r = Math.min(255, Math.round(data[i] / 16) * 16);
      const g = Math.min(255, Math.round(data[i + 1] / 16) * 16);
      const b = Math.min(255, Math.round(data[i + 2] / 16) * 16);

      // Skip near-white and near-black
      const brightness = (r + g + b) / 3;
      if (brightness > 230 || brightness < 25) continue;

      const key = `${r},${g},${b}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    // Sort by frequency
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) return null;

    const toHex = (rgb: string): string => {
      const [r, g, b] = rgb.split(",").map(Number);
      return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
    };

    return {
      primary: toHex(sorted[0][0]),
      secondary: sorted.length > 1 ? toHex(sorted[1][0]) : toHex(sorted[0][0]),
      accent: sorted.length > 2 ? toHex(sorted[2][0]) : toHex(sorted[0][0]),
      source: "logo_analysis",
    };
  } catch {
    return null;
  }
}
