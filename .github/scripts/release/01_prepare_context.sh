#!/usr/bin/env bash
set -euo pipefail

CONTEXT_FILE="/tmp/release-context.env"

REPO="${GITHUB_REPOSITORY}"
SHA="${RELEASE_TARGET:-${GITHUB_SHA}}"
NEW_TAG="${RELEASE_TAG:-$(git describe --tags --abbrev=0)}"
PREVIOUS_TAG="$(git tag --sort=-version:refname | grep -Fxv "$NEW_TAG" | head -n 1 || true)"

{
  echo "REPO=${REPO}"
  echo "SHA=${SHA}"
  echo "NEW_TAG=${NEW_TAG}"
  echo "PREVIOUS_TAG=${PREVIOUS_TAG}"
} > "$CONTEXT_FILE"

echo "Previous release: ${PREVIOUS_TAG:-none}"
echo "New release: ${NEW_TAG}"
echo "Saved release context to ${CONTEXT_FILE}"
