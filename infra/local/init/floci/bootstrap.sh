#!/usr/bin/env bash
# Orquestrador do bootstrap: espera o Floci responder e roda, em ordem, todos
# os scripts NN-*.sh desta pasta. Novos seeds entram só criando um NN-nome.sh.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
: "${AWS_ENDPOINT_URL:?AWS_ENDPOINT_URL obrigatório}"
export AWS_PAGER=""

WAIT_TIMEOUT="${FLOCI_WAIT_TIMEOUT:-120}"
WAIT_INTERVAL=2

# WHY: a sonda tem teto de tempo por tentativa e sem retentativa do CLI
# (AWS_MAX_ATTEMPTS=1): quem repete é o laço, e o WAIT_TIMEOUT conta o tempo
# decorrido de verdade, não o número de voltas. O erro da última tentativa vai
# na mensagem de timeout, para distinguir Floci fora do ar de credencial ou
# endpoint errados.
wait_for_floci() {
  local start=$SECONDS elapsed=0 last_error=""
  echo "== aguardando o Floci em ${AWS_ENDPOINT_URL} (timeout ${WAIT_TIMEOUT}s) =="
  until last_error=$(AWS_MAX_ATTEMPTS=1 aws --cli-connect-timeout 3 --cli-read-timeout 5 \
    --endpoint-url "$AWS_ENDPOINT_URL" sts get-caller-identity 2>&1 >/dev/null); do
    elapsed=$((SECONDS - start))
    if [ "$elapsed" -ge "$WAIT_TIMEOUT" ]; then
      echo "ERRO: o Floci não respondeu em ${WAIT_TIMEOUT}s. Último erro:" >&2
      echo "${last_error#$'\n'}" >&2
      exit 1
    fi
    sleep "$WAIT_INTERVAL"
  done
  echo "== Floci pronto ($((SECONDS - start))s) =="
}

wait_for_floci

# WHY: os seeds são independentes; um que falha não esconde o resultado dos
# outros, e o bootstrap só sai com erro depois de rodar todos.
failed=()
for script in "$SCRIPT_DIR"/[0-9][0-9]-*.sh; do
  [ -e "$script" ] || continue
  if ! bash "$script"; then
    failed+=("$(basename "$script")")
  fi
done

if [ "${#failed[@]}" -gt 0 ]; then
  echo "ERRO: bootstrap do Floci com falha em ${#failed[@]} seed(s): ${failed[*]}" >&2
  exit 1
fi
echo "== bootstrap do Floci concluído =="
