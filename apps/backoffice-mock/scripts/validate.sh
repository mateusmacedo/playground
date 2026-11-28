#!/usr/bin/env bash
# Valida o projeto sem subir o container: sintaxe do compose e dos scripts e o
# .env fora do git. O que não depende do Docker é conferido no target `test`.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

fail() {
  echo "ERRO: $*" >&2
  exit 1
}

docker compose config -q
echo "ok: docker compose config"

for script in scripts/*.sh; do
  bash -n "$script" || fail "sintaxe inválida: $script"
done
echo "ok: sintaxe dos scripts"

if git check-ignore -q .env 2>/dev/null; then
  echo "ok: .env ignorado pelo git"
else
  fail ".env não está ignorado pelo git"
fi
