/**
 * Agent Capability Registry — replaces name-based handler map with
 * capability metadata for routing, cost tracking, and reflection control.
 */

import type { AgentExecutionInput, AgentExecutionOutput, AgentHandler } from "../pipeline/agentRuntime.js";

export interface AgentCapability {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  requires_approval_for: string[];
  model_provider: "claude" | "openrouter" | "local" | "custom_lora";
  max_retries: number;
  timeout_ms: number;
  cost_per_run_estimate_usd: number;
  reflection_enabled: boolean;
  fallback_agent_id?: string;
}

export interface RegisteredAgent {
  capability: AgentCapability;
  handler: AgentHandler;
}

export class AgentCapabilityRegistry {
  private readonly agents = new Map<string, RegisteredAgent>();

  register(capability: AgentCapability, handler: AgentHandler): void {
    this.agents.set(capability.id, { capability, handler });
  }

  unregister(agentId: string): void {
    this.agents.delete(agentId);
  }

  has(agentId: string): boolean {
    return this.agents.has(agentId);
  }

  getCapability(agentId: string): AgentCapability | undefined {
    return this.agents.get(agentId)?.capability;
  }

  getHandler(agentId: string): AgentHandler | undefined {
    return this.agents.get(agentId)?.handler;
  }

  /** Find agents that declare a given capability string. */
  findByCapability(capability: string): AgentCapability[] {
    const result: AgentCapability[] = [];
    for (const { capability: cap } of this.agents.values()) {
      if (cap.capabilities.includes(capability)) {
        result.push(cap);
      }
    }
    return result;
  }

  /** Return the fallback agent for a given agent, if configured. */
  getFallback(agentId: string): RegisteredAgent | undefined {
    const primary = this.agents.get(agentId);
    if (!primary?.capability.fallback_agent_id) return undefined;
    return this.agents.get(primary.capability.fallback_agent_id);
  }

  listRegistered(): string[] {
    return Array.from(this.agents.keys());
  }

  listCapabilities(): AgentCapability[] {
    return Array.from(this.agents.values()).map((a) => a.capability);
  }

  /** Execute an agent by ID. Falls back to fallback agent on error if configured. */
  async execute(input: AgentExecutionInput): Promise<AgentExecutionOutput> {
    const registered = this.agents.get(input.agent_id);
    if (!registered) {
      throw new Error(
        `No agent registered for "${input.agent_id}". ` +
        `Registered: ${this.listRegistered().join(", ") || "(none)"}`,
      );
    }

    try {
      return await registered.handler(input);
    } catch (error) {
      const fallback = this.getFallback(input.agent_id);
      if (fallback) {
        return fallback.handler({
          ...input,
          agent_id: fallback.capability.id,
        });
      }
      throw error;
    }
  }
}
