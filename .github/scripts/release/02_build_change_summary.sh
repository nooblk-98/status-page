#!/usr/bin/env bash
set -euo pipefail

CONTEXT_FILE="/tmp/release-context.env"
SUMMARY_FILE="/tmp/change-summary.md"

if [[ ! -f "$CONTEXT_FILE" ]]; then
  echo "Missing ${CONTEXT_FILE}. Run 01_prepare_context.sh first."
  exit 1
fi

source "$CONTEXT_FILE"

if [[ -n "${PREVIOUS_TAG}" ]]; then
  git log --pretty=format:'- %s (%h)' "${PREVIOUS_TAG}".."${NEW_TAG}" > "$SUMMARY_FILE"
else
  git log --pretty=format:'- %s (%h)' "${NEW_TAG}" > "$SUMMARY_FILE"
fi

echo "Wrote change summary to ${SUMMARY_FILE}"
