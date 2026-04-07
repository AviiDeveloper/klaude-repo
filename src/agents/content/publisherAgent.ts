import { createLogger } from "../../lib/logger.js";
import { AgentHandler } from "../../pipeline/agentRuntime.js";

const log = createLogger("publisher");

interface PostPayload {
  platform: "tiktok" | "reels" | "shorts";
  payload: {
    caption: string;
    hashtags: string[];
    script: string;
    media_brief?: Record<string, unknown>;
    scheduled_for?: string;
  };
}

export const publisherAgent: AgentHandler = async (input) => {
  const scripts = (input.upstreamArtifacts?.scripts as Array<{
    topic: string;
    platform: string;
    hook: string;
    body: string[];
    cta: string;
    hashtags?: string[];
  }>) ?? [];

  const mediaBriefs = (input.upstreamArtifacts?.media_briefs as Array<{
    type: string;
    platform: string;
    description: string;
  }>) ?? [];

  if (scripts.length === 0) {
    return {
      summary: "No approved scripts to publish",
      artifacts: { queued: false },
    };
  }

  const postPayloads: PostPayload[] = [];

  for (const script of scripts) {
    const platform = script.platform as "tiktok" | "reels" | "shorts";
    if (!["tiktok", "reels", "shorts"].includes(platform)) continue;

    const caption = buildCaption(script);
    const matchingBrief = mediaBriefs.find(
      (b) => b.platform === platform && b.type === "thumbnail",
    );

    postPayloads.push({
      platform,
      payload: {
        caption,
        hashtags: script.hashtags ?? [],
        script: [script.hook, ...(script.body ?? []), script.cta].join("\n\n"),
        media_brief: matchingBrief,
      },
    });
  }

  log.info(`queued ${postPayloads.length} posts for dispatch`);

  return {
    summary: `Prepared ${postPayloads.length} posts for platform dispatch`,
    artifacts: {
      queued: true,
      post_count: postPayloads.length,
      platforms: [...new Set(postPayloads.map((p) => p.platform))],
      _decision: {
        reasoning: `Formatted ${postPayloads.length} posts from ${scripts.length} approved scripts. Platforms: ${[...new Set(postPayloads.map((p) => p.platform))].join(", ")}. Caption length: avg ${Math.round(postPayloads.reduce((s, p) => s + p.payload.caption.length, 0) / Math.max(postPayloads.length, 1))} chars.`,
        alternatives: ["Could optimize posting schedule by platform", "Could A/B test caption variants"],
        confidence: 0.85,
        tags: postPayloads.map((p) => `platform:${p.platform}`),
      },
    },
    post_payloads: postPayloads,
  };
};

function buildCaption(script: {
  hook: string;
  cta: string;
  hashtags?: string[];
}): string {
  const parts = [script.hook];
  if (script.cta) parts.push(`\n${script.cta}`);
  if (script.hashtags?.length) {
    parts.push(`\n${script.hashtags.map((h) => `#${h}`).join(" ")}`);
  }
  return parts.join("\n").slice(0, 2200); // Platform caption limits
}
