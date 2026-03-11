# Agent Contracts

## AgentRequest
Fields:
- task_id
- agent_name
- objective
- plan_step
- constraints
- inputs
- approval_token (optional)
- deadline (optional)

## AgentResponse
Fields:
- task_id
- agent_name
- status: ok | needs_approval | blocked | failed
- summary
- actions_proposed: array of side effects (if any)
- artifacts: array
- logs: array

## Side effect proposal schema
- type: file_write | shell_exec | network_call | git_push | message_send | deploy
- description
- scope
- risk_notes
- requires_approval: boolean

## Approval token rule
- Any side effect must include approval_token before execution.
- Without approval_token, agents may only propose actions.
