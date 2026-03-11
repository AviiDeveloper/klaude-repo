# OpenClaw Security Requirements

## Data minimization
- Only send what OpenClaw needs for interaction.
- Do not send secrets.

## Approval integrity
- Approval decisions must be bound to:
  - task_id
  - specific side effects
  - expiration time
- Approval tokens should be single-use where possible.

## Audit
- Log every inbound and outbound OpenClaw event.
- Redact personal data and secrets in logs.

## Fail closed
- If approval flow is uncertain, block side effects.
