import { queryOne } from '@/lib/db';
import type { OperatorProfile } from '@/lib/types';

export function resolveAuthorizedOperatorId(workspaceId: string): string | null {
  const envOperator = process.env.MISSION_CONTROL_OPERATOR_ID?.trim();
  if (envOperator) return envOperator;

  const profile = queryOne<OperatorProfile>(
    'SELECT operator_name FROM operator_profiles WHERE workspace_id = ?',
    [workspaceId],
  );
  if (profile?.operator_name?.trim()) {
    return profile.operator_name.trim();
  }
  return null;
}

export function isOperatorAuthorized(workspaceId: string, operatorId: string): boolean {
  const expected = resolveAuthorizedOperatorId(workspaceId);
  if (!expected) return true;
  return expected === operatorId;
}
