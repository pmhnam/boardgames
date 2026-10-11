#!/usr/bin/env bash
#
# Deploys one commit of the main branch on the server.
#
# Installed once as ~/apps/boardgames/deploy.sh and wired to the CI SSH key as its forced
# command (see docs/deployment.md), so that key can do exactly one thing: ask for a commit to be
# deployed. The commit arrives as the SSH command; run by hand, pass it as the first argument.

set -euo pipefail

APP_DIR="${BOARDGAMES_DIR:-$HOME/apps/boardgames}"
REPO_URL="https://github.com/pmhnam/boardgames.git"
BRANCH="main"

sha="${SSH_ORIGINAL_COMMAND:-${1:-}}"
if [[ ! "$sha" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Expected a full commit sha, got: '${sha}'" >&2
  exit 2
fi

cd "$APP_DIR"
if [[ ! -f .env ]]; then
  echo "Missing $APP_DIR/.env (see deploy/.env.example)." >&2
  exit 1
fi

# One deploy at a time.
exec 9>"$APP_DIR/.deploy.lock"
if ! flock -n 9; then
  echo "Another deploy is already running." >&2
  exit 1
fi

[[ -d repo/.git ]] || git clone --quiet "$REPO_URL" repo
git -C repo fetch --quiet origin "$BRANCH"

# Only what is on the main branch may be deployed.
if ! git -C repo merge-base --is-ancestor "$sha" "origin/$BRANCH"; then
  echo "Commit $sha is not on $BRANCH." >&2
  exit 1
fi
git -C repo checkout --quiet --detach "$sha"

# The images CI built for this commit, named by it.
export IMAGE_TAG="$sha"

compose() {
  docker compose --env-file "$APP_DIR/.env" -f "$APP_DIR/repo/deploy/compose.yaml" "$@"
}

# CI has already built and started these images once. Building here is only the way out when
# the registry cannot be reached or the images are not public: slower, and it takes the
# server's processor and memory away from the matches being played.
echo "Fetching ${sha:0:7}..."
# An image for another processor pulls without complaint and then cannot start.
made_for_this_server() {
  local wanted image
  wanted="$(docker version --format '{{.Server.Arch}}')"
  for image in $(compose config --images | grep '/boardgames/'); do
    [[ "$(docker image inspect --format '{{.Architecture}}' "$image")" == "$wanted" ]] || return 1
  done
}

if ! compose pull --quiet api web || ! made_for_this_server; then
  echo "No usable images to pull; building ${sha:0:7} here instead..."
  compose build --quiet
fi

echo "Starting..."
# --wait returns once every container reports healthy, and fails the deploy if one does not.
compose up --detach --remove-orphans --no-build --wait

# Drop this project's superseded images, pulled or built; other projects are left alone.
docker image prune --all --force \
  --filter "label=org.opencontainers.image.source=https://github.com/pmhnam/boardgames" >/dev/null
docker image prune --force --filter "label=com.docker.compose.project=boardgames" >/dev/null

echo "Deployed ${sha:0:7}."
compose ps --format 'table {{.Service}}\t{{.Status}}'
