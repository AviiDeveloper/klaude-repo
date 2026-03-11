# Builder Workflow (Mandatory)

This repo uses a strict paper trail system.

## Every implementation step must include
1. Code changes
2. Tests or verification commands
3. A changelog entry created in CHANGELOG/YYYY-MM/
4. If architecture or dependencies changed, an ADR entry in ADR/

## Changelog entry is mandatory
No implementation change is considered valid unless it has a matching changelog entry.

## File naming
CHANGELOG/YYYY-MM/YYYY-MM-DD_NNN_<milestone-shortname>.md
CHANGELOG/YYYY-MM/YYYY-MM-DD_NNN_<milestone-shortname>.json

Where:
- YYYY-MM-DD is the local date
- NNN is a 3 digit sequence for that day
- milestone-shortname matches SPEC.md milestone naming

## Switching models rule
Before switching models or starting a new session:
- Create a changelog entry describing the session boundary
- Include a Next steps section with explicit TODOs

## The model must NOT
- Modify SPEC.md or CONSTRAINTS.md without an ADR and a changelog entry
- Introduce new services without ADR approval
- Perform side effects without approval token logic implemented and logged
