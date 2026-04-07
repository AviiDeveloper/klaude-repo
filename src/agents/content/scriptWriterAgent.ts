import { createLogger } from "../../lib/logger.js";
import { AgentHandler } from "../../pipeline/agentRuntime.js";
import { callAi, parseAiJson } from "./aiCaller.js";

const log = createLogger("script-writer");

interface VideoScript {
  topic: string;
  platform: string;
  hook: string;
  body: string[];
  cta: string;
  duration_seconds: number;
  visual_notes: string[];
  hashtags: string[];
}

export const scriptWriterAgent: AgentHandler = async (input) => {
  const winners = (input.upstreamArtifacts?.winners as Array<{
    topic: string;
    angle: string;
    hook: string;
    target_platforms: string[];
  }>) ?? [];

  if (winners.length === 0) {
    return {
      summary: "No winning ideas to write scripts for",
      artifacts: { scripts: [] },
    };
  }

  const scripts: VideoScript[] = [];
  let totalCost = 0;

  for (const idea of winners) {
    const platforms = idea.target_platforms ?? ["tiktok", "reels", "shorts"];

    try {
      const result = await callAi({
        system: `You are an expert short-form video scriptwriter for small business content. Write scripts optimized for each platform.

Return a JSON object with a "scripts" array. Each script should have:
- topic: the topic
- platform: the target platform
- hook: opening 3-5 seconds (pattern interrupt, question, or bold claim)
- body: array of 3-5 talking points/scenes (each max 2 sentences)
- cta: closing call-to-action (max 1 sentence)
- duration_seconds: estimated video length (15-60s for TikTok, 15-90s for Reels, 15-60s for Shorts)
- visual_notes: array of 2-3 production suggestions (text overlays, b-roll, transitions)
- hashtags: 3-5 relevant hashtags without # prefix

Style guidelines:
- Conversational, not corporate
- Use "you" and "your" — speak directly to the viewer
- Lead with the most surprising or valuable point
- End with a clear, specific CTA (follow, comment, save, or visit link)
- Keep language accessible — no jargon`,
        user: `Write platform-specific scripts for:\nTopic: ${idea.topic}\nAngle: ${idea.angle}\nHook inspiration: ${idea.hook}\nPlatforms: ${platforms.join(", ")}`,
        jsonMode: true,
        maxTokens: 3000,
        temperature: 0.7,
      });

      const parsed = parseAiJson<{ scripts: VideoScript[] }>(result.content);
      scripts.push(...(parsed.scripts ?? []));
      totalCost += result.costUsd;
    } catch (error) {
      log.warn(`Script generation failed for "${idea.topic}"`, { error: String(error) });
      // Fallback script
      for (const platform of platforms) {
        scripts.push({
          topic: idea.topic,
          platform,
          hook: idea.hook || `Here's something most ${platform} creators miss...`,
          body: ["Point 1: Key insight", "Point 2: How to apply it", "Point 3: The result you'll see"],
          cta: "Follow for more business tips!",
          duration_seconds: 30,
          visual_notes: ["Text overlay with key stat", "B-roll of business activity"],
          hashtags: ["smallbusiness", "businesstips", platform],
        });
      }
    }
  }

  log.info(`generated ${scripts.length} scripts for ${winners.length} ideas`, { cost: totalCost });

  return {
    summary: `Generated ${scripts.length} scripts across ${winners.length} winning ideas`,
    artifacts: { scripts },
    cost_usd: totalCost,
  };
};
