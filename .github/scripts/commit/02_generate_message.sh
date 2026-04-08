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
CHANGED_FILES="$(printf '%s' "${changed_files_b64:-}" | base64 -d 2>/dev/null || true)"
SHORTSTAT="$(printf '%s' "${shortstat_b64:-}" | base64 -d 2>/dev/null || true)"

is_weak_subject() {
  local msg
  msg="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | xargs)"
  [[ -z "$msg" ]] && return 0
  [[ ${#msg} -lt 12 ]] && return 0
  [[ "$msg" =~ ^(update|updates|fix|fixes|change|changes|wip|temp|test|commit|done|misc)$ ]] && return 0
  [[ "$msg" == "chore: refine repository changes and automation scripts" ]] && return 0
  return 1
}

build_fallback_message() {
  local file_count
  local first_file
  local scope
  local subject

  file_count="$(printf '%s\n' "$CHANGED_FILES" | sed '/^$/d' | wc -l | xargs)"
  first_file="$(printf '%s\n' "$CHANGED_FILES" | sed '/^$/d' | head -n 1)"

  if printf '%s\n' "$CHANGED_FILES" | grep -Eq '^(README\.md|docs/|.*\.md$)'; then
    scope="docs"
    subject="docs: update documentation for recent changes"
  elif printf '%s\n' "$CHANGED_FILES" | grep -Eq '^\.github/'; then
    scope="ci"
    subject="ci: improve GitHub Actions automation scripts"
  elif printf '%s\n' "$CHANGED_FILES" | grep -Eq '^(server/|public/|config\.js)'; then
    scope="app"
    subject="feat: update ${scope} logic for latest code changes"
  else
    subject="chore: update project files with scoped improvements"
  fi

  if [[ -n "$first_file" ]]; then
    if [[ ${#first_file} -le 32 ]]; then
      subject="${subject} (${first_file})"
    fi
  fi

  {
    echo "$subject"
    echo
    echo "- Improve commit clarity using real file-level changes"
    if [[ -n "$SHORTSTAT" ]]; then
      echo "- Diff summary: $SHORTSTAT"
    fi
    if [[ -n "$CHANGED_FILES" ]]; then
      echo "- Updated files (${file_count}):"
      printf '%s\n' "$CHANGED_FILES" | sed 's/^/-   /'
    fi
    echo
    echo "[copilot-commit]"
  } > "$OUTPUT_FILE"
}

if [[ "${skip}" == "true" ]]; then
  echo "skip=true" > /tmp/commit-rewrite-result.env
  exit 0
fi

if [[ -z "${COPILOT_TOKEN:-}" ]]; then
  echo "Copilot token not configured. Falling back to deterministic template."
  build_fallback_message

  echo "skip=false" > /tmp/commit-rewrite-result.env
  echo "generated_message_file=${OUTPUT_FILE}" >> /tmp/commit-rewrite-result.env
  exit 0
fi

DIFF_CONTENT="$(cat "$DIFF_FILE")"
PAYLOAD="$(jq -n \
  --arg subject "${CURRENT_SUBJECT}" \
  --arg files "${CHANGED_FILES}" \
  --arg stat "${SHORTSTAT}" \
  --arg diff "$DIFF_CONTENT" \
  '{
    model: "gpt-4o",
    temperature: 0.2,
    max_tokens: 320,
    messages: [
      {
        role: "system",
        content: "You write high quality git commit messages. Return only a commit message with this format: first line is a clear conventional-commit subject (NOT generic words like update/fix/changes) under 72 chars, then a blank line, then 3-6 bullet points describing concrete changes from the diff and files. Do not include markdown fences. Do not invent changes. End with [copilot-commit]."
      },
      {
        role: "user",
        content: ("Current subject: " + $subject + "\\nShort stat: " + $stat + "\\nChanged files:\\n" + $files + "\\n\\nGit diff:\\n" + $diff)
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

NEW_SUBJECT="$(printf '%s' "$CLEAN_MSG" | head -n 1 | tr -d '\r')"
if is_weak_subject "$NEW_SUBJECT"; then
  echo "Copilot returned weak subject ('$NEW_SUBJECT'). Using deterministic fallback."
  build_fallback_message
else
  printf '%s\n' "$CLEAN_MSG" > "$OUTPUT_FILE"
fi

echo "skip=false" > /tmp/commit-rewrite-result.env
echo "generated_message_file=${OUTPUT_FILE}" >> /tmp/commit-rewrite-result.env

echo "Generated improved commit message at ${OUTPUT_FILE}"
