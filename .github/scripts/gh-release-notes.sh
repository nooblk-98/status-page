#!/usr/bin/env bash
set -euo pipefail

# Generate and publish release notes for an already-created GitHub release.
# Requires:
# - GH_TOKEN env var
# - git tags available (actions/checkout with fetch-depth: 0)

REPO="${GITHUB_REPOSITORY}"
SHA="${RELEASE_TARGET:-${GITHUB_SHA}}"
NEW_TAG="${RELEASE_TAG:-$(git describe --tags --abbrev=0)}"

PREVIOUS_TAG="$(git tag --sort=-version:refname | grep -Fxv "$NEW_TAG" | head -n 1 || true)"

echo "Previous release: ${PREVIOUS_TAG:-none}"
echo "New release: ${NEW_TAG}"

if [[ -n "$PREVIOUS_TAG" ]]; then
  git log --pretty=format:'- %s (%h)' "$PREVIOUS_TAG".."$NEW_TAG" > /tmp/change-summary.md
else
  git log --pretty=format:'- %s (%h)' "$NEW_TAG" > /tmp/change-summary.md
fi

if [[ -n "$PREVIOUS_TAG" ]]; then
  gh api \
    --method POST \
    -H "Accept: application/vnd.github+json" \
    "/repos/${REPO}/releases/generate-notes" \
    -f tag_name="$NEW_TAG" \
    -f target_commitish="$SHA" \
    -f previous_tag_name="$PREVIOUS_TAG" \
    > /tmp/generated-notes.json
else
  gh api \
    --method POST \
    -H "Accept: application/vnd.github+json" \
    "/repos/${REPO}/releases/generate-notes" \
    -f tag_name="$NEW_TAG" \
    -f target_commitish="$SHA" \
    > /tmp/generated-notes.json
fi

BODY="$(jq -r '.body' /tmp/generated-notes.json)"

{
  echo "## Release $NEW_TAG"
  echo
  echo "Previous release: ${PREVIOUS_TAG:-none}"
  echo "Compared to: $NEW_TAG"
  echo
  echo "### Reviewed Changes"
  cat /tmp/change-summary.md
  echo
  echo "### Detailed Release Notes"
  echo "$BODY"
} > /tmp/release-notes.md

gh release edit "$NEW_TAG" \
  --title "Release $NEW_TAG" \
  --notes-file /tmp/release-notes.md \
  --target "$SHA"

echo "Release ${NEW_TAG} notes updated successfully."
