#!/usr/bin/env bash
set -euo pipefail

RESULT_FILE="/tmp/commit-rewrite-result.env"

if [[ ! -f "$RESULT_FILE" ]]; then
  echo "Missing ${RESULT_FILE}. Run 02_generate_message.sh first."
  exit 1
fi

source "$RESULT_FILE"

if [[ "${skip}" == "true" ]]; then
  echo "Skipping rewrite because commit already processed."
  exit 0
fi

if [[ -z "${generated_message_file:-}" ]] || [[ ! -f "${generated_message_file}" ]]; then
  echo "Generated commit message file missing."
  exit 1
fi

GIT_AUTHOR_NAME="${COMMIT_USER_NAME:-${GITHUB_ACTOR}}"
GIT_AUTHOR_EMAIL="${COMMIT_USER_EMAIL:-${GITHUB_ACTOR}@users.noreply.github.com}"

git config user.name "$GIT_AUTHOR_NAME"
git config user.email "$GIT_AUTHOR_EMAIL"

# Amend only message; tree stays unchanged.
git commit --amend -F "${generated_message_file}" --no-verify

# Push amended commit back to current branch.
BRANCH_NAME="${GITHUB_REF_NAME}"
git push --force-with-lease origin "HEAD:${BRANCH_NAME}"

echo "Rewrote and pushed improved commit message to ${BRANCH_NAME}."
