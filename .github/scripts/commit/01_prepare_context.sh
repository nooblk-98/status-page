#!/usr/bin/env bash
set -euo pipefail

CONTEXT_FILE="/tmp/commit-context.env"
DIFF_FILE="/tmp/commit.diff"

CURRENT_MSG="$(git log -1 --pretty=%B | tr -d '\r')"
CURRENT_SUBJECT="$(git log -1 --pretty=%s | tr -d '\r')"
COMMIT_SHA="$(git rev-parse HEAD)"
CURRENT_SUBJECT_B64="$(printf '%s' "$CURRENT_SUBJECT" | base64 -w 0)"

# Skip if this commit was already rewritten by this workflow.
if [[ "$CURRENT_MSG" == *"[copilot-commit]"* ]]; then
  echo "skip=true" > "$CONTEXT_FILE"
  echo "Commit already rewritten by Copilot workflow."
  exit 0
fi

# Generate a bounded diff to keep API payload manageable.
git show --patch --unified=2 --no-color --format=fuller "$COMMIT_SHA" | head -c 60000 > "$DIFF_FILE"

{
  echo "skip=false"
  echo "commit_sha=${COMMIT_SHA}"
  echo "current_subject_b64=${CURRENT_SUBJECT_B64}"
  echo "context_file=${CONTEXT_FILE}"
  echo "diff_file=${DIFF_FILE}"
} > "$CONTEXT_FILE"

echo "Prepared commit context at ${CONTEXT_FILE}"
