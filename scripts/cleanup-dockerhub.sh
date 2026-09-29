#!/usr/bin/env bash
# Apaga tags sha antigas no Docker Hub (API).
# Mantem as KEEP shas mais recentes; latest/homolog/semver nao sao sha e ficam.
set -euo pipefail

IMAGE_NAME="${IMAGE_NAME:?}"
USER="${DOCKERHUB_USERNAME:?}"
PASS="${DOCKERHUB_TOKEN:?}"
KEEP="${KEEP:-10}"

NS="${IMAGE_NAME%%/*}"
REPO="${IMAGE_NAME#*/}"

TOKEN=$(curl -fsS -H 'Content-Type: application/json' \
  -d "{\"username\":\"${USER}\",\"password\":\"${PASS}\"}" \
  https://hub.docker.com/v2/users/login/ | jq -r .token)

curl -fsS -H "Authorization: JWT ${TOKEN}" \
  "https://hub.docker.com/v2/repositories/${NS}/${REPO}/tags?page_size=100&ordering=last_updated" \
  | jq -r '
      .results[]
      | select(.name | test("^[0-9a-f]{40}$"))
      | .name' \
  | tail -n "+$((KEEP + 1))" \
  | while read -r tag; do
      echo "delete ${tag}"
      curl -fsS -X DELETE -H "Authorization: JWT ${TOKEN}" \
        "https://hub.docker.com/v2/repositories/${NS}/${REPO}/tags/${tag}/" || true
    done
