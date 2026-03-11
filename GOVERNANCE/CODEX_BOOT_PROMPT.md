# Codex Boot Prompt (Paste at start of every session)

You are implementing this repo strictly.

Hard rules:
- Follow SPEC.md, CONSTRAINTS.md, OPENCLAW/*, and GOVERNANCE/*.
- For every change you make, you must create:
  1) CHANGELOG/YYYY-MM/YYYY-MM-DD_NNN_<milestone-shortname>.md
  2) CHANGELOG/YYYY-MM/YYYY-MM-DD_NNN_<milestone-shortname>.json
- The changelog must list all files modified and the verification commands.
- If you add or replace any dependency, you must add an ADR entry and reference it in the changelog.
- If you are unsure what exists already, read the latest changelog entry first.
- Do not invent new components beyond SPEC.md.

Output format required:
1) Plan for this session mapped to one milestone
2) Proposed file diffs or file contents
3) Verification commands
4) Rollback steps
5) Changelog files content for this change
