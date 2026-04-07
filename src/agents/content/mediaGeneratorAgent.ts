import { createLogger } from "../../lib/logger.js";
import { AgentHandler } from "../../pipeline/agentRuntime.js";
import { callAi, parseAiJson, flattenUpstream } from "./aiCaller.js";

const log = createLogger("media-generator");

interface MediaAsset {
  type: "image_prompt" | "video_concept" | "thumbnail";
  platform: string;
  description: string;
  dimensions: string;
  style_notes: string;
  text_overlay?: string;
}

export const mediaGeneratorAgent: AgentHandler = async (input) => {
  const upstream = flattenUpstream(input.upstreamArtifacts);
  const scripts = (upstream.scripts as Array<{
    topic: string;
    platform: string;
    hook: string;
    visual_notes: string[];
  }>) ?? [];

  if (scripts.length === 0) {
    return {
      summary: "No scripts to generate media for",
      artifacts: { media_briefs: [] },
    };
  }

  // Generate detailed media briefs using AI — actual image/video generation
  // would require integration with services like Midjourney, DALL-E, or Runway
  const learningContext = (input.upstreamArtifacts._learningContext as string) ?? "";

  try {
    const result = await callAi({
      system: `You are a media production planner for short-form video content. For each script, create detailed media asset specifications that a designer or AI image generator could use.

Return a JSON object with a "media_briefs" array. Each brief should have:
- type: "image_prompt" for still images, "video_concept" for video clips, "thumbnail" for thumbnails
- platform: target platform
- description: detailed visual description (50-150 words for image prompts, shorter for others)
- dimensions: "1080x1920" for vertical, "1080x1080" for square, "1920x1080" for landscape
- style_notes: visual style guidance (colors, mood, composition)
- text_overlay: any text that should appear on the image (optional)

For each script, generate:
1. A thumbnail image prompt
2. 1-2 supporting visual assets (background images, b-roll concepts)

Keep the style professional but approachable — suitable for a small business audience.
${learningContext ? `\n${learningContext}` : ""}`,
      user: `Create media briefs for these scripts:\n${scripts.map((s, i) => `${i + 1}. [${s.platform}] ${s.topic}\n   Hook: ${s.hook}\n   Visuals: ${s.visual_notes?.join("; ") ?? "none specified"}`).join("\n\n")}`,
      jsonMode: true,
      maxTokens: 3000,
      temperature: 0.7,
    });

    const parsed = parseAiJson<{ media_briefs: MediaAsset[] }>(result.content);
    const mediaBriefs = parsed.media_briefs ?? [];

    log.info(`generated ${mediaBriefs.length} media briefs`, { cost: result.costUsd });

    return {
      summary: `Created ${mediaBriefs.length} media asset briefs for ${scripts.length} scripts`,
      artifacts: {
        media_briefs: mediaBriefs,
        scripts,
        generation_status: "briefs_only",
        _decision: {
          reasoning: `Generated ${mediaBriefs.length} media briefs covering ${[...new Set(mediaBriefs.map((b) => b.type))].join(", ")} types. Briefs only — no actual image generation yet.`,
          alternatives: ["Could integrate DALL-E for actual image generation", "Could use Runway for video generation"],
          confidence: 0.7,
          tags: mediaBriefs.map((b) => `media:${b.type}`),
        },
      },
      cost_usd: result.costUsd,
    };
  } catch (error) {
    log.warn("AI media brief generation failed", { error: String(error) });
    const briefs = scripts.map((s) => ({
      type: "thumbnail" as const,
      platform: s.platform,
      description: `Thumbnail for: ${s.topic}`,
      dimensions: "1080x1920",
      style_notes: "Professional, clean, bold text overlay",
      text_overlay: s.hook?.slice(0, 50),
    }));
    return {
      summary: `Created ${briefs.length} fallback media briefs`,
      artifacts: { media_briefs: briefs, scripts, generation_status: "fallback" },
    };
  }
};
