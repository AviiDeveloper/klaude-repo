import { createLogger } from "../../lib/logger.js";
import { AgentHandler } from "../../pipeline/agentRuntime.js";
import { callAi, parseAiJson } from "./aiCaller.js";

const log = createLogger("idea-ranker");

interface RankedIdea {
  topic: string;
  angle: string;
  hook: string;
  target_platforms: string[];
  viral_potential: number;
  production_difficulty: number;
  final_score: number;
}

export const ideaRankerAgent: AgentHandler = async (input) => {
  const topics = (input.upstreamArtifacts?.topics as Array<{ topic: string; category?: string }>) ?? [];
  const verifiedTopics = (input.upstreamArtifacts?.verified_topics as Array<{ topic: string; freshness_score?: number }>) ?? topics;

  if (verifiedTopics.length === 0) {
    return {
      summary: "No topics to rank",
      artifacts: { ranked_ideas: [], winners: [] },
    };
  }

  const learningContext = (input.upstreamArtifacts._learningContext as string) ?? "";

  try {
    const result = await callAi({
      system: `You are a content strategy agent specializing in short-form video for small business audiences. For each topic, generate 2-3 unique content angles and rank them.

Return a JSON object with a "ideas" array. Each idea should have:
- topic: the source topic
- angle: specific content angle (max 100 chars)
- hook: opening line/hook for the video (max 150 chars)
- target_platforms: ["tiktok", "reels", "shorts"] — which platforms suit this content
- viral_potential: 0.0-1.0 (likelihood of high engagement)
- production_difficulty: 0.0-1.0 (0 = easy talking head, 1 = complex production)
- final_score: 0.0-1.0 (overall recommendation score, weighting viral potential high and difficulty low)

Sort by final_score descending. Return at most 15 ideas total.

Prioritize:
- Pattern-interrupt hooks that stop the scroll
- Actionable advice viewers can use immediately
- Relatable pain points for local business owners
- "Did you know?" and myth-busting angles
${learningContext ? `\n${learningContext}` : ""}`,
      user: `Generate and rank content ideas from these verified topics:\n${verifiedTopics.map((t, i) => `${i + 1}. ${t.topic}`).join("\n")}`,
      jsonMode: true,
      maxTokens: 3000,
      temperature: 0.8,
    });

    const parsed = parseAiJson<{ ideas: RankedIdea[] }>(result.content);
    const ideas = (parsed.ideas ?? [])
      .sort((a, b) => b.final_score - a.final_score)
      .slice(0, 15);

    const winners = ideas.slice(0, 3);

    log.info(`ranked ${ideas.length} ideas, ${winners.length} winners`, { cost: result.costUsd });

    return {
      summary: `Ranked ${ideas.length} content ideas. Top 3 winners selected.`,
      artifacts: {
        ranked_ideas: ideas,
        winners,
        _decision: {
          reasoning: `Ranked ${ideas.length} ideas by viral_potential×(1-production_difficulty). Top winner: "${winners[0]?.angle}" (score ${winners[0]?.final_score})`,
          alternatives: ["Could weight by platform-specific engagement data", "Could factor in posting time optimization"],
          confidence: ideas.length >= 5 ? 0.8 : 0.5,
          tags: winners.flatMap((w) => w.target_platforms?.map((p: string) => `platform:${p}`) ?? []),
        },
      },
      cost_usd: result.costUsd,
    };
  } catch (error) {
    log.warn("AI ranking failed, using simple scoring", { error: String(error) });
    const ideas = verifiedTopics.map((t, i) => ({
      topic: t.topic,
      angle: t.topic,
      hook: `Did you know? ${t.topic}`,
      target_platforms: ["tiktok", "reels", "shorts"],
      viral_potential: 0.5,
      production_difficulty: 0.3,
      final_score: Number((0.9 - i * 0.05).toFixed(2)),
    }));
    return {
      summary: `Ranked ${ideas.length} ideas using fallback scoring`,
      artifacts: { ranked_ideas: ideas, winners: ideas.slice(0, 3) },
    };
  }
};
