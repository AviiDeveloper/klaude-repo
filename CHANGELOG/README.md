# CHANGELOG

This folder contains the immutable paper trail for this system.

## Rules
- Every change gets:
  - one Markdown entry
  - one JSON entry
- Changelogs are append-only. Do not edit old entries.
  - If correction is needed, create a new entry referencing the old one.

## Purpose
- Preserve context across model swaps
- Provide auditability
- Make it easy to reconstruct the build
- Prevent undocumented drift

## Naming
CHANGELOG/YYYY-MM/YYYY-MM-DD_NNN_<milestone-shortname>.md
CHANGELOG/YYYY-MM/YYYY-MM-DD_NNN_<milestone-shortname>.json
