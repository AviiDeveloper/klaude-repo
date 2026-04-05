#!/usr/bin/env bash
# kb-lookup.sh — Auto-retrieves relevant business knowledge when editing app files.
# Called as a PreToolUse hook by Claude Code before Edit/Write operations.
# Reads tool input from stdin (JSON), greps knowledge/ for relevant context.

set -euo pipefail

KNOWLEDGE_DIR="$(cd "$(dirname "$0")/.." && pwd)/knowledge"
[[ -d "$KNOWLEDGE_DIR" ]] || exit 0

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty' 2>/dev/null)
[[ -z "$FILE_PATH" ]] && exit 0

# Only trigger for app files
case "$FILE_PATH" in
  *apps/sales-dashboard/*|*apps/admin-panel/*|*apps/ios/*|*apps/mobile-api/*|*apps/mobile/*|*apps/mission-control/*) ;;
  *) exit 0 ;;
esac

# Map path components to knowledge search terms
TERMS=()
FILENAME=$(basename "$FILE_PATH" | tr '[:upper:]' '[:lower:]')
FULLPATH=$(echo "$FILE_PATH" | tr '[:upper:]' '[:lower:]')

# Match on filename and path keywords
[[ "$FULLPATH" =~ lead|assignment ]] && TERMS+=(lead assignment lifecycle)
[[ "$FULLPATH" =~ auth|login|token|session ]] && TERMS+=(auth token HMAC contract)
[[ "$FULLPATH" =~ payment|stripe|checkout|payout|commission ]] && TERMS+=(payment stripe commission checkout)
[[ "$FULLPATH" =~ demo|site ]] && TERMS+=(demo-link demo-site conversion)
[[ "$FULLPATH" =~ training|academy|lesson ]] && TERMS+=(training unit lesson academy)
[[ "$FULLPATH" =~ type|model ]] && TERMS+=(entity canonical salesperson)
[[ "$FULLPATH" =~ db|database|schema|migrat ]] && TERMS+=(database sqlite supabase schema)
[[ "$FULLPATH" =~ route|api|endpoint ]] && TERMS+=(endpoint api-surface route)
[[ "$FULLPATH" =~ sync|push|visit|photo ]] && TERMS+=(mobile sync visit)
[[ "$FULLPATH" =~ status ]] && TERMS+=(AssignmentStatus DemoLinkStatus enum)

# If no terms matched, try the app name as context
if [[ ${#TERMS[@]} -eq 0 ]]; then
  [[ "$FULLPATH" =~ sales-dashboard ]] && TERMS+=(salesperson dashboard)
  [[ "$FULLPATH" =~ admin-panel ]] && TERMS+=(admin team pipeline)
  [[ "$FULLPATH" =~ mobile-api ]] && TERMS+=(mobile api training)
  [[ "$FULLPATH" =~ ios ]] && TERMS+=(iOS SwiftUI mobile)
fi

[[ ${#TERMS[@]} -eq 0 ]] && exit 0

# Build grep pattern from unique terms
PATTERN=$(printf '%s\n' "${TERMS[@]}" | sort -u | paste -sd'|' -)
[[ -z "$PATTERN" ]] && exit 0

# Search knowledge files (case-insensitive, filenames only, max 3)
MATCHES=$(grep -rli -E "$PATTERN" "$KNOWLEDGE_DIR" 2>/dev/null | head -3) || true
[[ -z "$MATCHES" ]] && exit 0

# Build context from matching files
CONTEXT=""
while IFS= read -r match; do
  RELATIVE=${match#"$KNOWLEDGE_DIR/"}
  SNIPPET=$(sed -n '/^#/,/^---$/p' "$match" | head -25 | grep -v '^---$' | grep -v '^tags:' | grep -v '^related:')
  [[ -z "$SNIPPET" ]] && SNIPPET=$(head -30 "$match" | grep -v '^---$' | grep -v '^tags:' | grep -v '^related:' | head -20)
  CONTEXT="${CONTEXT}
--- knowledge/${RELATIVE} ---
${SNIPPET}
"
done <<< "$MATCHES"

CONTEXT=$(echo "$CONTEXT" | head -c 3000)
jq -n --arg ctx "$CONTEXT" '{"additionalContext": ("Business knowledge context:\n" + $ctx)}'
