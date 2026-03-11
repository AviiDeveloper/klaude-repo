import { queryAll } from '@/lib/db';
import type { Agent } from '@/lib/types';

function normalize(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function slugify(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function findAgentByAlias(agents: Agent[], alias: string): Agent | undefined {
  const normAlias = normalize(alias);
  if (!normAlias) {
    return undefined;
  }
  return agents.find((agent) => {
    const name = normalize(agent.name);
    const role = normalize(agent.role);
    return (
      name === normAlias ||
      role === normAlias ||
      normAlias.includes(name) ||
      normAlias.includes(role) ||
      name.includes(normAlias) ||
      role.includes(normAlias)
    );
  });
}

export function inferAssignedAgentId(input: {
  workspaceId: string;
  title?: string;
  description?: string;
  explicitAssignedAgentId?: string | null;
}): string | undefined {
  if (input.explicitAssignedAgentId) {
    return input.explicitAssignedAgentId;
  }

  const text = `${input.title ?? ''}\n${input.description ?? ''}`.trim();
  if (!text) {
    return undefined;
  }

  const agents = queryAll<Agent>(
    'SELECT * FROM agents WHERE workspace_id = ? ORDER BY is_master DESC, name ASC',
    [input.workspaceId],
  );
  if (agents.length === 0) {
    return undefined;
  }

  const lower = text.toLowerCase();

  for (const agent of agents) {
    if (lower.includes(agent.id.toLowerCase())) {
      return agent.id;
    }
  }

  const mention = lower.match(/@([a-z0-9][a-z0-9_-]{1,40})/);
  if (mention) {
    const alias = mention[1];
    const byMention = agents.find((agent) => {
      const nameSlug = slugify(agent.name);
      const roleSlug = slugify(agent.role);
      return alias === nameSlug || alias === roleSlug;
    });
    if (byMention) {
      return byMention.id;
    }
  }

  const assignToMatch = lower.match(/assign(?:ed)?(?:\s+this|\s+task)?\s+to\s+([a-z0-9 _-]{2,140})/);
  if (assignToMatch) {
    const byPhrase = findAgentByAlias(agents, assignToMatch[1]);
    if (byPhrase) {
      return byPhrase.id;
    }
  }

  const forMatch = lower.match(/\bfor\s+([a-z0-9 _-]{2,60})/);
  if (forMatch) {
    const byFor = findAgentByAlias(agents, forMatch[1]);
    if (byFor) {
      return byFor.id;
    }
  }

  if (lower.includes('assign')) {
    const byInlineName = agents.find((agent) => {
      const name = normalize(agent.name);
      const role = normalize(agent.role);
      return lower.includes(name) || lower.includes(role);
    });
    if (byInlineName) {
      return byInlineName.id;
    }
  }

  return undefined;
}

export function pickDefaultAssignedAgentId(workspaceId: string): string | undefined {
  const candidates = queryAll<{ id: string; active_count: number; status: string }>(
    `
      SELECT
        a.id,
        a.status,
        COUNT(t.id) AS active_count
      FROM agents a
      LEFT JOIN tasks t
        ON t.assigned_agent_id = a.id
       AND t.status IN ('planning', 'inbox', 'assigned', 'in_progress', 'testing', 'review')
      WHERE a.workspace_id = ?
      GROUP BY a.id, a.status
      ORDER BY
        CASE a.status
          WHEN 'working' THEN 0
          WHEN 'standby' THEN 1
          ELSE 2
        END ASC,
        active_count ASC,
        a.id ASC
      LIMIT 1
    `,
    [workspaceId],
  );

  return candidates[0]?.id;
}
