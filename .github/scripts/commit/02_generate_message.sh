#!/usr/bin/env bash
set -euo pipefail

CONTEXT_FILE="/tmp/commit-context.env"
DIFF_FILE="/tmp/commit.diff"
OUTPUT_FILE="/tmp/commit-message.txt"

if [[ ! -f "$CONTEXT_FILE" ]]; then
  echo "Missing ${CONTEXT_FILE}. Run 01_prepare_context.sh first."
  exit 1
fi

source "$CONTEXT_FILE"

CURRENT_SUBJECT="$(printf '%s' "${current_subject_b64}" | base64 -d)"

if [[ "${skip}" == "true" ]]; then
  echo "skip=true" > /tmp/commit-rewrite-result.env
  exit 0
fi

if [[ -z "${COPILOT_TOKEN:-}" ]]; then
  echo "Copilot token not configured. Falling back to deterministic template."
  {
    echo "chore: update code based on latest changes"
    echo
    echo "- Update project files in this commit"
    echo "- Align implementation with current diff"
    echo
    echo "[copilot-commit]"
  } > "$OUTPUT_FILE"

  echo "skip=false" > /tmp/commit-rewrite-result.env
  echo "generated_message_file=${OUTPUT_FILE}" >> /tmp/commit-rewrite-result.env
  exit 0
fi

DIFF_CONTENT="$(cat "$DIFF_FILE")"
PAYLOAD="$(jq -n \
  --arg subject "${CURRENT_SUBJECT}" \
  --arg diff "$DIFF_CONTENT" \
  '{
    model: "gpt-4o",
    temperature: 0.2,
    max_tokens: 320,
    messages: [
      {
        role: "system",
        content: "You write high quality git commit messages. Return only a commit message with this format: first line is a concise conventional-commit style subject under 72 chars, then a blank line, then 3-6 bullet points describing real code changes. Do not include markdown fences. Do not invent changes. End with [copilot-commit]."
      },
      {
        role: "user",
        content: ("Current subject: " + $subject + "\\n\\nGit diff:\\n" + $diff)
      }
    ]
  }')"

RAW_MSG="$(curl -sS https://api.githubcopilot.com/chat/completions \
  -H "Authorization: Bearer ${COPILOT_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Copilot-Integration-Id: github-actions" \
  -H "Editor-Version: vscode/1.90.0" \
  -H "Editor-Plugin-Version: copilot-chat/0.17.0" \
  -d "$PAYLOAD" | jq -r '.choices[0].message.content // empty' | tr -d '\r')"

if [[ -z "$RAW_MSG" ]]; then
  echo "Copilot returned empty message."
  exit 1
fi

# Strip accidental markdown fences if present.
CLEAN_MSG="$(printf '%s\n' "$RAW_MSG" | sed '1s/^```[a-zA-Z]*$//' | sed '$s/^```$//')"
printf '%s\n' "$CLEAN_MSG" > "$OUTPUT_FILE"

echo "skip=false" > /tmp/commit-rewrite-result.env
echo "generated_message_file=${OUTPUT_FILE}" >> /tmp/commit-rewrite-result.env

echo "Generated improved commit message at ${OUTPUT_FILE}"
