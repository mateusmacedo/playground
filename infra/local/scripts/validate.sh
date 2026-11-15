#!/usr/bin/env bash
# Valida o ambiente local sem subir containers: sintaxe do compose, presença
# dos arquivos, sintaxe dos scripts e coerência entre o compose e o .env.example.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

fail() {
  echo "ERRO: $*" >&2
  exit 1
}

required=(
  docker-compose.yml
  .env.example
  README.md
  init/floci/_common.sh
  init/floci/bootstrap.sh
  init/floci/01-generic.sh
)
for file in "${required[@]}"; do
  [[ -f "$file" ]] || fail "arquivo ausente: $file"
done

docker compose config -q
echo "ok: docker compose config"

for script in init/floci/*.sh scripts/*.sh; do
  bash -n "$script" || fail "sintaxe inválida: $script"
done
echo "ok: sintaxe dos scripts"

# WHY: além de `image:`, o compose passa imagem ao Floci por variável
# (FLOCI_SERVICES_UI_IMAGE); as duas formas precisam do digest.
unpinned=$(awk '/^[[:space:]]*(image|[A-Z0-9_]+_IMAGE):/ && !/@sha256:/ {print "  linha " FNR ": " $0}' docker-compose.yml)
if [[ -n "$unpinned" ]]; then
  fail "imagem sem digest fixado em docker-compose.yml:"$'\n'"$unpinned"
fi
echo "ok: imagens fixadas por digest"

# WHY: os padrões do compose e o .env.example são mantidos à mão; esta checagem
# impede que uma variável nova entre no compose sem documentação.
missing=0
while read -r name; do
  if ! grep -qE "^${name}=" .env.example; then
    echo "ERRO: variável ${name} do compose ausente em .env.example" >&2
    missing=1
  fi
done < <(grep -vE '^\s*#' docker-compose.yml | grep -oE '\$\{[A-Za-z_][A-Za-z0-9_]*' | sed 's/^\${//' | sort -u)
[[ "$missing" -eq 0 ]] || exit 1
echo "ok: .env.example cobre as variáveis do compose"

if git check-ignore -q .env 2>/dev/null; then
  echo "ok: .env ignorado pelo git"
else
  fail ".env não está ignorado pelo git"
fi
