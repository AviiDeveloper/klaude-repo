# Changelog Schema

Two files per change:
1) Markdown: human readable
2) JSON: machine readable

## Markdown must include
- Title
- Date and sequence
- Milestone mapping
- Summary (3 to 8 bullets)
- Files changed (paths)
- New components (if any)
- Behavior changes
- Tests or verification
- Rollback steps
- Risks and mitigations
- Next steps

## JSON must include
- change_id
- timestamp
- milestone
- title
- summary
- files_changed[]
- decisions_refs[] (ADR ids)
- tests_run[]
- rollback_steps[]
- open_items[]
