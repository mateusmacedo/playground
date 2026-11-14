#!/usr/bin/env bash
# Smoke test (L6) dos serviços de container atrás do ALB do Floci, pelo host:
# sem regra o listener responde 404 e, para cada serviço do env services,
# GET /health pelo host e GET /<serviço> pelo path respondem 2xx.
#
# WHY: o listener do ALB abre dentro do container do Floci; o infra/local
# publica a porta 80 em 127.0.0.1:${FLOCI_ALB_HTTP_PORT} (padrão 8088).
set -euo pipefail

readonly http_port="${FLOCI_ALB_HTTP_PORT:-8088}"
readonly base_url="http://localhost:${http_port}"
readonly repo_root="$(git rev-parse --show-toplevel)"
readonly services_dir="${repo_root}/infra/terraform/envs/local/services"
# NOTE: um target recém-registrado leva alguns segundos para ficar saudável.
readonly max_attempts="${SMOKE_MAX_ATTEMPTS:-30}"
readonly wait_seconds=2

export TF_DATA_DIR="${repo_root}/tmp/terraform/infra-local-services"
routes="$(terraform -chdir="${services_dir}" output -json routes)"

failed=0

# check <regex do status esperado> <descrição> <argumentos do curl...>
check() {
  local expected="$1"
  local label="$2"
  shift 2

  local status=""
  local curl_exit=0
  local attempt
  for ((attempt = 1; attempt <= max_attempts; attempt++)); do
    # WHY: o status 000 sozinho não diz se foi conexão recusada (7), timeout
    # (28) ou conexão resetada (56); o exit do curl da última tentativa vai na
    # mensagem de falha.
    curl_exit=0
    status="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$@")" || curl_exit=$?
    if [[ "${status}" =~ ${expected} ]]; then
      printf 'ok     %s  %s\n' "${status}" "${label}"
      return 0
    fi
    sleep "${wait_seconds}"
  done

  printf 'FALHA  %s  %s (esperado %s, %s tentativas, curl exit %s)\n' \
    "${status:-000}" "${label}" "${expected}" "${max_attempts}" "${curl_exit}"
  failed=1
}

check '^404$' "GET ${base_url}/ (sem regra)" "${base_url}/"

services="$(jq -r 'to_entries[] | "\(.key) \(.value.host)"' <<<"${routes}")"
if [[ -z "${services}" ]]; then
  echo "AVISO: o output 'routes' de ${services_dir} não tem serviço; só a rota sem regra foi verificada." >&2
fi

verified=0
while read -r name host; do
  [[ -n "${name}" ]] || continue
  check '^2[0-9][0-9]$' "GET ${base_url}/health (Host: ${host})" \
    -H "Host: ${host}" "${base_url}/health"
  check '^2[0-9][0-9]$' "GET ${base_url}/${name}" "${base_url}/${name}"
  verified=$((verified + 1))
done <<<"${services}"

printf '%s serviço(s) verificado(s)\n' "${verified}"
exit "${failed}"
