import { createLogger } from "../../lib/logger.js";
import { AgentHandler } from "../../pipeline/agentRuntime.js";
import { callAi, parseAiJson } from "./aiCaller.js";

const log = createLogger("research-verifier");

interface VerifiedTopic {
  topic: string;
  verified: boolean;
  freshness_score: number;
  evidence: string[];
  concerns: string[];
}

export const researchVerifierAgent: AgentHandler = async (input) => {
  const topics = (input.upstreamArtifacts?.topics as Array<{ topic: string; category: string }>) ?? [];

  if (topics.length === 0) {
    return {
      summary: "No topics to verify",
      artifacts: { verified_topics: [], rejected_topics: [] },
    };
  }

  try {
    const result = await callAi({
      system: `You are a research verification agent. Your job is to assess whether trending topics are:
1. Still timely and relevant (not stale news)
2. Factually accurate (no misinformation)
3. Appropriate for a professional business audience (no controversial/political)
4. Actionable (viewer can do something with the information)

Return a JSON object with a "results" array. Each result should have:
- topic: the original topic string
- verified: true/false
- freshness_score: 0.0-1.0 (1.0 = breaking news, 0.5 = still relevant, 0.0 = outdated)
- evidence: array of 1-3 supporting points
- concerns: array of any issues found (empty if none)

Reject topics that are purely speculative, politically divisive, or potentially harmful to recommend.`,
      user: `Verify these topics for a small business content pipeline:\n${topics.map((t, i) => `${i + 1}. ${t.topic} [${t.category}]`).join("\n")}`,
      jsonMode: true,
      maxTokens: 2000,
      temperature: 0.3,
    });

    const parsed = parseAiJson<{ results: VerifiedTopic[] }>(result.content);
    const results = parsed.results ?? [];
    const verified = results.filter((r) => r.verified);
    const rejected = results.filter((r) => !r.verified);

    log.info(`verified ${verified.length}/${results.length} topics`, { cost: result.costUsd });

    return {
      summary: `Verified ${verified.length} topics, rejected ${rejected.length}`,
      artifacts: {
        verified_topics: verified,
        rejected_topics: rejected,
        topics: verified.map((v) => {
          const original = topics.find((t) => t.topic === v.topic);
          return { ...original, ...v };
        }),
      },
      cost_usd: result.costUsd,
    };
  } catch (error) {
    log.warn("AI verification failed, passing all topics through", { error: String(error) });
    return {
      summary: `Passed ${topics.length} topics through (verification unavailable)`,
      artifacts: {
        verified_topics: topics.map((t) => ({
          ...t,
          verified: true,
          freshness_score: 0.7,
          evidence: ["AI verification unavailable — passed through"],
          concerns: [],
        })),
        rejected_topics: [],
        topics,
      },
    };
  }
};
