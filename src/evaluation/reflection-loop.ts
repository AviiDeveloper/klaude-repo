/**
 * Reflection Loop — wraps agent execution with AI critique→retry cycle.
 *
 * When an agent produces output, the Critic evaluates it. If the score is
 * below threshold, the Critic's specific suggestions are injected back into
 * the agent's input and the agent retries. This continues until the output
 * passes or max iterations are reached.
 *
 * Each iteration is recorded for episodic memory.
 */

import { createLogger } from "../lib/logger.js";
import type { AgentExecutionInput, AgentExecutionOutput, AgentHandler } from "../pipeline/agentRuntime.js";
import type { CriticEvaluation, CriticInput, CriticModel } from "./critic-model.js";

const log = createLogger("reflection-loop");

// ── Interfaces ──

export interface ReflectionConfig {
  /** Minimum score to accept output (default: 0.7) */
  threshold: number;
  /** Maximum reflection iterations (default: 3) */
  maxIterations: number;
  /** Whether to force-accept best output after max iterations (default: true) */
  forceAcceptBest: boolean;
}

export interface ReflectionIteration {
  iteration: number;
  evaluation: CriticEvaluation;
  accepted: boolean;
  output: AgentExecutionOutput;
}

export interface ReflectionOutput {
  /** The final output (best or accepted) */
  finalOutput: AgentExecutionOutput;
  /** All iterations with evaluations */
  iterations: ReflectionIteration[];
  /** Whether the output was accepted by the critic */
  accepted: boolean;
  /** Score of the final output */
  finalScore: number;
  /** Total cost across all iterations (agent + critic) */
  totalCostUsd: number;
  /** Whether this was force-accepted after max iterations */
  forceAccepted: boolean;
  /** Whether human review is recommended */
  needsHumanReview: boolean;
}

export interface ReflectionInput {
  /** Original agent execution input */
  agentInput: AgentExecutionInput;
  /** The agent handler to execute */
  handler: AgentHandler;
  /** Business context for the critic */
  businessContext?: CriticInput["businessContext"];
  /** Working memory snapshot */
  workingMemorySnapshot?: Record<string, unknown>;
}

// ── Default config ──

const DEFAULT_CONFIG: ReflectionConfig = {
  threshold: Number(process.env.CRITIC_THRESHOLD ?? "0.7"),
  maxIterations: Number(process.env.CRITIC_MAX_RETRIES ?? "3"),
  forceAcceptBest: true,
};

// ── Reflection Loop ──

export class ReflectionLoop {
  constructor(
    private readonly critic: CriticModel,
    private readonly config: ReflectionConfig = DEFAULT_CONFIG,
  ) {}

  async executeWithReflection(input: ReflectionInput): Promise<ReflectionOutput> {
    const iterations: ReflectionIteration[] = [];
    let bestOutput: AgentExecutionOutput | null = null;
    let bestScore = -1;
    let bestEvaluation: CriticEvaluation | null = null;
    let totalCostUsd = 0;
    let previousCritique: CriticEvaluation | undefined;

    for (let i = 1; i <= this.config.maxIterations; i++) {
      // Build agent input — inject previous critique on retry
      const enrichedInput = this.enrichInputWithCritique(
        input.agentInput,
        previousCritique,
        i,
      );

      // Execute the agent
      let output: AgentExecutionOutput;
      try {
        output = await input.handler(enrichedInput);
      } catch (error) {
        log.error("agent execution failed during reflection", {
          agent_id: input.agentInput.agent_id,
          iteration: i,
          error: String(error),
        });
        // If the agent itself fails, we can't evaluate — break
        if (bestOutput) break;
        throw error;
      }

      totalCostUsd += output.cost_usd ?? 0;

      // Evaluate with the critic
      const criticInput: CriticInput = {
        agentOutput: output.artifacts,
        agentId: input.agentInput.agent_id,
        nodeId: input.agentInput.node_id,
        runId: input.agentInput.run_id,
        businessContext: input.businessContext,
        workingMemorySnapshot: input.workingMemorySnapshot,
        previousCritique,
        iteration: i,
      };

      const evaluation = await this.critic.evaluate(criticInput);
      totalCostUsd += evaluation.cost_usd;

      // Track best
      if (evaluation.score > bestScore) {
        bestScore = evaluation.score;
        bestOutput = output;
        bestEvaluation = evaluation;
      }

      const accepted = evaluation.score >= this.config.threshold;

      iterations.push({
        iteration: i,
        evaluation,
        accepted,
        output,
      });

      log.info("reflection iteration", {
        run_id: input.agentInput.run_id,
        agent_id: input.agentInput.agent_id,
        iteration: i,
        score: evaluation.score,
        prediction: evaluation.prediction,
        accepted,
        strengths: evaluation.critique.strengths.length,
        weaknesses: evaluation.critique.weaknesses.length,
        cost_usd: totalCostUsd,
      });

      if (accepted) {
        return {
          finalOutput: output,
          iterations,
          accepted: true,
          finalScore: evaluation.score,
          totalCostUsd,
          forceAccepted: false,
          needsHumanReview: false,
        };
      }

      // Set up for next iteration
      previousCritique = evaluation;
    }

    // Max iterations reached — force accept best or fail
    const forceAccept = this.config.forceAcceptBest && bestOutput !== null;

    log.warn("reflection loop exhausted", {
      run_id: input.agentInput.run_id,
      agent_id: input.agentInput.agent_id,
      best_score: bestScore,
      iterations: iterations.length,
      force_accepted: forceAccept,
      total_cost_usd: totalCostUsd,
    });

    if (forceAccept && bestOutput) {
      return {
        finalOutput: bestOutput,
        iterations,
        accepted: false,
        finalScore: bestScore,
        totalCostUsd,
        forceAccepted: true,
        needsHumanReview: true,
      };
    }

    // No output at all (shouldn't happen, but defensive)
    throw new Error(
      `Reflection loop failed: no acceptable output after ${iterations.length} iterations ` +
      `(best score: ${bestScore}, threshold: ${this.config.threshold})`,
    );
  }

  /**
   * Enrich the agent input with the previous critique's feedback.
   * The critique is injected into upstreamArtifacts so the agent can read it
   * and adjust its output accordingly.
   */
  private enrichInputWithCritique(
    original: AgentExecutionInput,
    previousCritique: CriticEvaluation | undefined,
    iteration: number,
  ): AgentExecutionInput {
    if (!previousCritique || iteration === 1) {
      return original;
    }

    // Build a clear feedback prompt the agent can consume
    const feedbackLines: string[] = [
      `## Critic Feedback (Iteration ${iteration - 1} scored ${previousCritique.score.toFixed(2)})`,
      "",
      "Your previous output was evaluated and needs improvement.",
      "",
    ];

    if (previousCritique.critique.weaknesses.length > 0) {
      feedbackLines.push("### Weaknesses to address:");
      for (const w of previousCritique.critique.weaknesses) {
        feedbackLines.push(`- ${w}`);
      }
      feedbackLines.push("");
    }

    if (previousCritique.critique.specific_suggestions.length > 0) {
      feedbackLines.push("### Specific changes requested:");
      for (const s of previousCritique.critique.specific_suggestions) {
        feedbackLines.push(`- ${s}`);
      }
      feedbackLines.push("");
    }

    if (previousCritique.critique.strengths.length > 0) {
      feedbackLines.push("### Keep these strengths:");
      for (const s of previousCritique.critique.strengths) {
        feedbackLines.push(`- ${s}`);
      }
    }

    return {
      ...original,
      upstreamArtifacts: {
        ...original.upstreamArtifacts,
        _criticFeedback: feedbackLines.join("\n"),
        _criticScore: previousCritique.score,
        _criticIteration: iteration,
        _criticWeaknesses: previousCritique.critique.weaknesses,
        _criticSuggestions: previousCritique.critique.specific_suggestions,
        _criticStrengths: previousCritique.critique.strengths,
      },
    };
  }
}
