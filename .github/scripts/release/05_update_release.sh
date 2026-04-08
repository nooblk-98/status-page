#!/usr/bin/env bash
set -euo pipefail

CONTEXT_FILE="/tmp/release-context.env"
TITLE_FILE="/tmp/release-title.txt"
NOTES_FILE="/tmp/release-notes.md"

if [[ ! -f "$CONTEXT_FILE" ]]; then
  echo "Missing ${CONTEXT_FILE}. Run 01_prepare_context.sh first."
  exit 1
fi

if [[ ! -f "$TITLE_FILE" ]]; then
  echo "Missing ${TITLE_FILE}. Run 04_generate_release_title.sh first."
  exit 1
fi

if [[ ! -f "$NOTES_FILE" ]]; then
  echo "Missing ${NOTES_FILE}. Run 03_generate_release_notes.sh first."
  exit 1
fi

source "$CONTEXT_FILE"
RELEASE_TITLE="$(cat "$TITLE_FILE")"

gh release edit "${NEW_TAG}" \
  --title "${RELEASE_TITLE}" \
  --notes-file "$NOTES_FILE" \
  --target "${SHA}"

echo "Release ${NEW_TAG} updated successfully."
