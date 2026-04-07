import { createLogger } from "../../lib/logger.js";
import { AgentHandler } from "../../pipeline/agentRuntime.js";
import { callAi, parseAiJson } from "./aiCaller.js";

const log = createLogger("trend-scout");

interface TrendTopic {
  topic: string;
  category: string;
  relevance_score: number;
  reasoning: string;
}

export const trendScoutAgent: AgentHandler = async (input) => {
  const config = input.config as {
    verticals?: string[];
    max_topics?: number;
  } | undefined;

  const verticals = config?.verticals ?? [
    "small business",
    "local services",
    "digital marketing",
    "AI tools",
  ];
  const maxTopics = config?.max_topics ?? 8;

  // Fetch RSS headlines if source URLs configured
  const headlines = await fetchRssHeadlines();

  const learningContext = (input.upstreamArtifacts._learningContext as string) ?? "";

  try {
    const result = await callAi({
      system: `You are a trend research agent for a content pipeline targeting small business owners and local service providers. Your job is to identify trending topics that would make good short-form video content (TikTok, Reels, Shorts).

Return a JSON object with a "topics" array. Each topic should have:
- topic: concise topic title (max 80 chars)
- category: one of "business_tips", "marketing", "technology", "industry_news", "how_to"
- relevance_score: 0.0-1.0 (how relevant to small business audience)
- reasoning: one sentence on why this is trending now

Focus on: ${verticals.join(", ")}
Return at most ${maxTopics} topics, sorted by relevance_score descending.
${learningContext ? `\n${learningContext}` : ""}`,
      user: headlines.length > 0
        ? `Based on these recent headlines, identify trending topics:\n${headlines.join("\n")}`
        : `Identify ${maxTopics} currently trending topics relevant to small businesses and local services. Focus on actionable, practical content that would perform well as short-form video.`,
      jsonMode: true,
      maxTokens: 1500,
      temperature: 0.8,
    });

    const parsed = parseAiJson<{ topics: TrendTopic[] }>(result.content);
    const topics = (parsed.topics ?? []).slice(0, maxTopics);

    log.info(`found ${topics.length} trending topics`, { cost: result.costUsd });

    return {
      summary: `Identified ${topics.length} trending topics across ${verticals.join(", ")}`,
      artifacts: {
        topics,
        verticals,
        source: headlines.length > 0 ? "rss+ai" : "ai",
        _decision: {
          reasoning: `Selected ${topics.length} topics from ${headlines.length} RSS headlines + AI analysis. Prioritized by relevance_score to ${verticals.join("/")} audience.`,
          alternatives: ["Could use Google Trends API", "Could scrape Reddit/Twitter for trends", "Could weight by recency over relevance"],
          confidence: topics.length >= 3 ? 0.8 : 0.5,
          tags: verticals.map((v) => `vertical:${v}`),
        },
      },
      cost_usd: result.costUsd,
    };
  } catch (error) {
    log.warn("AI trend scouting failed, using fallback", { error: String(error) });
    return {
      summary: "Used fallback trending topics (AI unavailable)",
      artifacts: {
        topics: getFallbackTopics(maxTopics),
        verticals,
        source: "fallback",
      },
    };
  }
};

async function fetchRssHeadlines(): Promise<string[]> {
  // TODO: Read from source_registry table when wired up
  // For now, try a few public RSS feeds
  const feeds = [
    "https://news.ycombinator.com/rss",
    "https://feeds.feedburner.com/TechCrunch/",
  ];

  const headlines: string[] = [];
  for (const feedUrl of feeds) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const resp = await fetch(feedUrl, { signal: controller.signal });
      clearTimeout(timeout);
      if (!resp.ok) continue;
      const xml = await resp.text();
      // Simple regex to extract titles from RSS XML
      const titleMatches = xml.matchAll(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/g);
      let count = 0;
      for (const match of titleMatches) {
        const title = (match[1] ?? match[2])?.trim();
        if (title && title.length > 10 && count < 10) {
          headlines.push(title);
          count++;
        }
      }
    } catch {
      // RSS fetch failures are non-fatal
    }
  }
  return headlines;
}

function getFallbackTopics(max: number): TrendTopic[] {
  const defaults: TrendTopic[] = [
    { topic: "5 AI tools every small business should use in 2026", category: "technology", relevance_score: 0.95, reasoning: "AI adoption is accelerating among SMBs" },
    { topic: "Google Business Profile tips to rank higher locally", category: "marketing", relevance_score: 0.9, reasoning: "Local SEO remains top driver of new customers" },
    { topic: "How to respond to negative reviews professionally", category: "business_tips", relevance_score: 0.85, reasoning: "Reputation management is evergreen for local businesses" },
    { topic: "Simple website changes that increase bookings by 30%", category: "how_to", relevance_score: 0.85, reasoning: "Conversion optimization has immediate ROI" },
    { topic: "Social media mistakes killing your local business reach", category: "marketing", relevance_score: 0.8, reasoning: "Algorithm changes impact organic reach" },
    { topic: "Building customer loyalty without a big budget", category: "business_tips", relevance_score: 0.75, reasoning: "Retention costs less than acquisition" },
  ];
  return defaults.slice(0, max);
}
