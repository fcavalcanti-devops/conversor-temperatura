#!/usr/bin/env bash
# Smoke da imagem: /health (app up) + rotas de conversao + pagina + user nao-root.
# Uso: ./scripts/smoke.sh <imagem> [porta_host]
set -euo pipefail

IMAGE="${1:?informe a imagem Docker}"
PORT="${2:-8080}"
NAME="${SMOKE_NAME:-smoke}"

dump_logs() {
  echo "--- logs do container ($NAME) ---"
  docker logs "$NAME" 2>&1 || true
}

cleanup() {
  docker rm -f "$NAME" >/dev/null 2>&1 || true
}

fail() {
  echo "$1"
  dump_logs
  exit 1
}

trap cleanup EXIT

docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" -p "${PORT}:8080" "$IMAGE" >/dev/null

pronto=0
for _ in $(seq 1 20); do
  if curl -fsS "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then
    pronto=1
    break
  fi
  sleep 1
done

if [ "$pronto" != 1 ]; then
  fail "A aplicacao nao respondeu em /health"
fi

# /health so confirma processo vivo. Abaixo: API e view.
body_c2f="$(curl -fsS "http://127.0.0.1:${PORT}/celsius/0/fahrenheit")" \
  || fail "Falha no GET /celsius/0/fahrenheit"
echo "$body_c2f" | grep -q '"fahrenheit":32' \
  || fail "Resposta inesperada em /celsius/0/fahrenheit: $body_c2f"

body_f2c="$(curl -fsS "http://127.0.0.1:${PORT}/fahrenheit/32/celsius")" \
  || fail "Falha no GET /fahrenheit/32/celsius"
echo "$body_f2c" | grep -q '"celsius":0' \
  || fail "Resposta inesperada em /fahrenheit/32/celsius: $body_f2c"

html="$(curl -fsS "http://127.0.0.1:${PORT}/")" \
  || fail "Falha no GET /"
echo "$html" | grep -q 'Conversor de Temperatura' \
  || fail "Pagina / sem o titulo esperado"

if [ "$(docker exec "$NAME" id -u)" = 0 ]; then
  fail "O container esta rodando como root"
fi

echo "Smoke OK (${IMAGE})"
