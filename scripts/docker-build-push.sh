#!/usr/bin/env bash
set -euo pipefail

# Build & push docker image tagged with the version in package.json.
#
# Usage:
#   REGISTRY=ghcr.io/<owner> IMAGE=yomi-manga ./scripts/docker-build-push.sh
#   # Push both :<version> and :latest
#   PUSH_LATEST=1 ./scripts/docker-build-push.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required but was not found in PATH" >&2
  exit 1
fi

VERSION="$(node -p "JSON.parse(require('fs').readFileSync('package.json','utf8')).version")"
if [[ -z "$VERSION" ]]; then
  echo "failed to read version from package.json" >&2
  exit 1
fi

IMAGE="${IMAGE:-$(node -p "JSON.parse(require('fs').readFileSync('package.json','utf8')).name")}" 
REGISTRY="${REGISTRY:-}"
DOCKERFILE="${DOCKERFILE:-Dockerfile}"
CONTEXT="${CONTEXT:-.}"

if [[ -z "$IMAGE" ]]; then
  echo "IMAGE is empty; set IMAGE env var or package.json name" >&2
  exit 1
fi

FULL_IMAGE="$IMAGE"
if [[ -n "$REGISTRY" ]]; then
  FULL_IMAGE="$REGISTRY/$IMAGE"
fi

VERSION_TAG="$FULL_IMAGE:$VERSION"
LATEST_TAG="$FULL_IMAGE:latest"

echo "Building: $VERSION_TAG"
docker build -f "$DOCKERFILE" -t "$VERSION_TAG" "$CONTEXT"

echo "Pushing: $VERSION_TAG"
docker push "$VERSION_TAG"

if [[ "${PUSH_LATEST:-0}" == "1" ]]; then
  echo "Tagging: $LATEST_TAG"
  docker tag "$VERSION_TAG" "$LATEST_TAG"

  echo "Pushing: $LATEST_TAG"
  docker push "$LATEST_TAG"
fi

echo "Done."