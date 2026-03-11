export type ReferenceSheetLifecycleState = 'draft' | 'active' | 'archived';
export type ReferenceSheetLifecycleAction = 'create' | 'version' | 'revise' | 'archive';

interface TransitionInput {
  action: ReferenceSheetLifecycleAction;
  hasExistingSheets: boolean;
  currentState?: ReferenceSheetLifecycleState | null;
}

interface TransitionResult {
  ok: boolean;
  toState?: ReferenceSheetLifecycleState;
  message?: string;
}

export function normalizeLifecycleState(state: string | null | undefined): ReferenceSheetLifecycleState {
  if (state === 'draft' || state === 'archived') return state;
  return 'active';
}

export function validateReferenceSheetTransition(input: TransitionInput): TransitionResult {
  const currentState = input.currentState ? normalizeLifecycleState(input.currentState) : null;

  if (input.action === 'create') {
    if (input.hasExistingSheets) {
      return { ok: false, message: 'create requires an agent with no existing reference sheet history' };
    }
    return { ok: true, toState: 'active' };
  }

  if (!input.hasExistingSheets || !currentState) {
    return { ok: false, message: `${input.action} requires an existing reference sheet` };
  }

  if (currentState === 'archived') {
    return { ok: false, message: `${input.action} cannot start from archived state` };
  }

  if (input.action === 'version') {
    return { ok: true, toState: 'active' };
  }
  if (input.action === 'revise') {
    return { ok: true, toState: 'draft' };
  }
  if (input.action === 'archive') {
    return { ok: true, toState: 'archived' };
  }

  return { ok: false, message: `unsupported transition action: ${input.action}` };
}
