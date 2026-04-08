#!/usr/bin/env bash
set -euo pipefail

CONTEXT_FILE="/tmp/release-context.env"
SUMMARY_FILE="/tmp/change-summary.md"
TITLE_FILE="/tmp/release-title.txt"

if [[ ! -f "$CONTEXT_FILE" ]]; then
  echo "Missing ${CONTEXT_FILE}. Run 01_prepare_context.sh first."
  exit 1
fi

if [[ ! -f "$SUMMARY_FILE" ]]; then
  echo "Missing ${SUMMARY_FILE}. Run 02_build_change_summary.sh first."
  exit 1
fi

source "$CONTEXT_FILE"

if [[ -n "${COPILOT_TOKEN:-}" ]]; then
  COPILOT_PAYLOAD="$(jq -n \
    --arg tag "${NEW_TAG}" \
    --arg summary "$(cat "$SUMMARY_FILE")" \
    '{
      model: "gpt-4o",
      temperature: 0.2,
      max_tokens: 40,
      messages: [
        {
          role: "system",
          content: "Generate one short professional GitHub release title. Return only plain text with no quotes, markdown, or punctuation at the end. Keep it under 70 characters."
        },
        {
          role: "user",
          content: ("Tag: " + $tag + "\\nChanges:\\n" + $summary)
        }
      ]
    }')"

  AI_TITLE="$(curl -sS https://api.githubcopilot.com/chat/completions \
    -H "Authorization: Bearer ${COPILOT_TOKEN}" \
    -H "Content-Type: application/json" \
    -H "Copilot-Integration-Id: github-actions" \
    -H "Editor-Version: vscode/1.90.0" \
    -H "Editor-Plugin-Version: copilot-chat/0.17.0" \
    -d "$COPILOT_PAYLOAD" | jq -r '.choices[0].message.content // empty' | head -n 1 | tr -d '\r')"

  RELEASE_TITLE="${AI_TITLE:-Release ${NEW_TAG}}"
else
  RELEASE_TITLE="Release ${NEW_TAG}"
fi

echo "${RELEASE_TITLE}" > "$TITLE_FILE"
echo "Release title: ${RELEASE_TITLE}"
echo "Wrote title to ${TITLE_FILE}"
