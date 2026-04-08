#!/usr/bin/env bash
set -euo pipefail

CONTEXT_FILE="/tmp/release-context.env"
SUMMARY_FILE="/tmp/change-summary.md"
GENERATED_JSON="/tmp/generated-notes.json"
NOTES_FILE="/tmp/release-notes.md"

if [[ ! -f "$CONTEXT_FILE" ]]; then
  echo "Missing ${CONTEXT_FILE}. Run 01_prepare_context.sh first."
  exit 1
fi

if [[ ! -f "$SUMMARY_FILE" ]]; then
  echo "Missing ${SUMMARY_FILE}. Run 02_build_change_summary.sh first."
  exit 1
fi

source "$CONTEXT_FILE"

if [[ -n "${PREVIOUS_TAG}" ]]; then
  gh api \
    --method POST \
    -H "Accept: application/vnd.github+json" \
    "/repos/${REPO}/releases/generate-notes" \
    -f tag_name="${NEW_TAG}" \
    -f target_commitish="${SHA}" \
    -f previous_tag_name="${PREVIOUS_TAG}" \
    > "$GENERATED_JSON"
else
  gh api \
    --method POST \
    -H "Accept: application/vnd.github+json" \
    "/repos/${REPO}/releases/generate-notes" \
    -f tag_name="${NEW_TAG}" \
    -f target_commitish="${SHA}" \
    > "$GENERATED_JSON"
fi

BODY="$(jq -r '.body' "$GENERATED_JSON")"

FEATURES_FILE="/tmp/release-features.md"
FIXES_FILE="/tmp/release-fixes.md"
IMPROVEMENTS_FILE="/tmp/release-improvements.md"
OTHERS_FILE="/tmp/release-others.md"

rm -f "$FEATURES_FILE" "$FIXES_FILE" "$IMPROVEMENTS_FILE" "$OTHERS_FILE"

while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  lower_line="$(printf '%s' "$line" | tr '[:upper:]' '[:lower:]')"

  if [[ "$lower_line" =~ feat|feature|add|introduc|implement|new ]]; then
    echo "$line" >> "$FEATURES_FILE"
  elif [[ "$lower_line" =~ fix|bug|hotfix|patch|error|issue|resolve ]]; then
    echo "$line" >> "$FIXES_FILE"
  elif [[ "$lower_line" =~ improve|enhanc|refactor|optimi|perf|speed|cleanup|upgrade|chore ]]; then
    echo "$line" >> "$IMPROVEMENTS_FILE"
  else
    echo "$line" >> "$OTHERS_FILE"
  fi
done < "$SUMMARY_FILE"

{
  echo "## Release ${NEW_TAG}"
  echo
  echo "Previous release: ${PREVIOUS_TAG:-none}"
  echo "Compared to: ${NEW_TAG}"
  echo
  echo "### New Features"
  if [[ -s "$FEATURES_FILE" ]]; then
    cat "$FEATURES_FILE"
  else
    echo "- No feature commits detected in this release range"
  fi
  echo
  echo "### Bug Fixes"
  if [[ -s "$FIXES_FILE" ]]; then
    cat "$FIXES_FILE"
  else
    echo "- No fix commits detected in this release range"
  fi
  echo
  echo "### Improvements"
  if [[ -s "$IMPROVEMENTS_FILE" ]]; then
    cat "$IMPROVEMENTS_FILE"
  else
    echo "- No improvement commits detected in this release range"
  fi
  if [[ -s "$OTHERS_FILE" ]]; then
    echo
    echo "### Other Changes"
    cat "$OTHERS_FILE"
  fi
  echo
  echo "### Detailed Release Notes"
  echo "$BODY"
} > "$NOTES_FILE"

echo "Wrote release notes to ${NOTES_FILE}"
