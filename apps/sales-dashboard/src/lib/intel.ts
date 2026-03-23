/**
 * Intelligence Engine — generates talking points from pipeline data.
 *
 * Pure function. No LLM calls. Everything derived from scraped business data,
 * brief directives, and profile analysis.
 *
 * The goal: give the salesman exactly what they need to walk in and pitch
 * confidently, without reading pages of data.
 */

import type { LeadDetail, TalkingPoint, TalkingPointType } from './types';

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

export function generateTalkingPoints(lead: LeadDetail): TalkingPoint[] {
  const points: TalkingPoint[] = [];

  // --- OPPORTUNITIES (why they need a site) ---

  if (!lead.has_website) {
    points.push({
      icon: 'globe-off',
      text: 'No website detected — perfect candidate for a new site',
      type: 'opportunity',
      priority: 5,
    });
  } else if (lead.website_quality_score !== null && lead.website_quality_score < 40) {
    points.push({
      icon: 'alert-triangle',
      text: `Their current website scores ${lead.website_quality_score}/100 — show them the upgrade`,
      type: 'opportunity',
      priority: 4,
    });
  } else if (lead.website_quality_score !== null && lead.website_quality_score < 70) {
    points.push({
      icon: 'trending-up',
      text: `Website scores ${lead.website_quality_score}/100 — room for improvement`,
      type: 'opportunity',
      priority: 3,
    });
  }

  // --- STRENGTHS (positive things about the business) ---

  if (lead.google_rating !== null && lead.google_rating >= 4.5 && lead.google_review_count) {
    points.push({
      icon: 'star',
      text: `Rated ${lead.google_rating}\u2605 with ${lead.google_review_count} reviews — they care about their reputation`,
      type: 'strength',
      priority: 4,
    });
  } else if (lead.google_rating !== null && lead.google_rating >= 4.0 && lead.google_review_count) {
    points.push({
      icon: 'star',
      text: `${lead.google_rating}\u2605 from ${lead.google_review_count} reviews — solid reputation to showcase`,
      type: 'strength',
      priority: 3,
    });
  } else if (lead.google_rating !== null && lead.google_rating > 0 && lead.google_rating < 3.5) {
    points.push({
      icon: 'trending-up',
      text: `Rated ${lead.google_rating}\u2605 — a professional website could help improve their image`,
      type: 'opportunity',
      priority: 3,
    });
  }

  // --- DEMO SITE ---

  if (lead.has_demo_site) {
    points.push({
      icon: 'monitor-smartphone',
      text: 'Demo site ready — show them on your phone',
      type: 'strength',
      priority: 5,
    });
  }

  // --- SERVICES ---

  if (lead.services.length > 0) {
    const top = lead.services.slice(0, 4).join(', ');
    points.push({
      icon: 'list-checks',
      text: `Main services: ${top}`,
      type: 'info',
      priority: 3,
    });
  }

  // --- TRUST BADGES (what to mention) ---

  if (lead.trust_badges.length > 0) {
    points.push({
      icon: 'badge-check',
      text: `Mention: ${lead.trust_badges.join(', ')}`,
      type: 'strength',
      priority: 3,
    });
  }

  // --- AVOID TOPICS (what NOT to say) ---

  if (lead.avoid_topics.length > 0) {
    points.push({
      icon: 'ban',
      text: `Don't mention: ${lead.avoid_topics.join(', ')}`,
      type: 'warning',
      priority: 4,
    });
  }

  // --- OPENING HOURS ---

  if (lead.opening_hours.length > 0) {
    const bestTime = suggestVisitTime(lead.opening_hours);
    points.push({
      icon: 'clock',
      text: bestTime
        ? `${formatHoursCompact(lead.opening_hours)} — best to visit ${bestTime}`
        : formatHoursCompact(lead.opening_hours),
      type: 'info',
      priority: 2,
    });
  }

  // --- PAIN POINTS ---

  if (lead.pain_points.length > 0) {
    for (const pain of lead.pain_points.slice(0, 2)) {
      points.push({
        icon: 'lightbulb',
        text: pain,
        type: 'opportunity',
        priority: 3,
      });
    }
  }

  // --- BEST REVIEWS (quotable social proof) ---

  if (lead.best_reviews.length > 0) {
    const best = lead.best_reviews[0];
    const snippet = best.text.length > 80 ? best.text.slice(0, 80) + '\u2026' : best.text;
    points.push({
      icon: 'quote',
      text: `Top review: "${snippet}" — ${best.author}`,
      type: 'strength',
      priority: 2,
    });
  }

  // --- CTA ---

  if (lead.cta_text) {
    points.push({
      icon: 'mouse-pointer-click',
      text: `Their CTA: "${lead.cta_text}" — we've tailored the demo for this`,
      type: 'info',
      priority: 2,
    });
  }

  // --- GALLERY ---

  if (lead.gallery_filenames.length >= 3) {
    points.push({
      icon: 'images',
      text: `${lead.gallery_filenames.length} photos scraped — demo uses their real images`,
      type: 'strength',
      priority: 2,
    });
  }

  // Sort by priority (highest first), then by type weight
  return points.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return typeWeight(a.type) - typeWeight(b.type);
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function typeWeight(type: TalkingPointType): number {
  switch (type) {
    case 'opportunity': return 1;
    case 'strength': return 2;
    case 'warning': return 3;
    case 'info': return 4;
  }
}

function formatHoursCompact(hours: string[]): string {
  if (hours.length === 0) return 'Hours not available';
  if (hours.length <= 2) return hours.join(', ');
  // Try to summarise
  return `Open ${hours.length} days (${hours[0].split(':')[0]?.trim() || 'varies'})`;
}

function suggestVisitTime(hours: string[]): string | null {
  // Look for patterns like "Monday: 9:00-17:00"
  for (const h of hours) {
    const match = h.match(/(\d{1,2}):?(\d{2})?\s*[-–]\s*(\d{1,2})/);
    if (match) {
      const openHour = parseInt(match[1], 10);
      if (openHour <= 10) return 'mid-morning (10-11am)';
      if (openHour <= 12) return 'early afternoon';
      return 'after they open';
    }
  }
  return null;
}
