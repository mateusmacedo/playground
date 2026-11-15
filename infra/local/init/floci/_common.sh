#!/usr/bin/env bash
# Helpers do bootstrap do Floci. Lido via `source` pelos scripts NN-*.sh.
set -euo pipefail
: "${AWS_ENDPOINT_URL:?AWS_ENDPOINT_URL obrigatório}"
: "${AWS_REGION:?AWS_REGION obrigatório}"

WARNINGS=0
FAILURES=0

# WHY: sem timeout explícito, uma conexão travada prende o bootstrap até o
# timeout do container.
awsl() {
  aws --cli-connect-timeout 5 --cli-read-timeout 30 \
    --endpoint-url "$AWS_ENDPOINT_URL" "$@"
}

log() { echo "  $*"; }

warn() {
  WARNINGS=$((WARNINGS + 1))
  echo "  AVISO: $*" >&2
}

fail() {
  FAILURES=$((FAILURES + 1))
  echo "  ERRO: $*" >&2
}

# NOTE: formato com que o Floci 2.4.0 recusa uma operação que não implementa
# (ex.: "UnsupportedOperation: Operation X is not supported."); os demais são
# os nomes de erro de ação desconhecida do protocolo da AWS.
FLOCI_UNSUPPORTED_PATTERN='UnsupportedOperation|UnknownOperation|InvalidAction|NotImplemented'

# WHY: o Floci emula só parte dos serviços e atributos da AWS. Recurso que ele
# declara não suportar vira aviso e o seed segue; qualquer outra falha (rede,
# credencial, parâmetro inválido) é erro e derruba o bootstrap no resumo final.
report_failure() {
  local description="$1" raw_output="$2" output
  output=$(trim "${raw_output//$'\n'/ }")
  if [[ "$output" =~ $FLOCI_UNSUPPORTED_PATTERN ]]; then
    warn "${description}, não suportado pelo Floci: ${output}"
  else
    fail "${description}: ${output}"
  fi
}

try() {
  local description="$1" output
  shift
  if output=$("$@" 2>&1); then
    return 0
  fi
  report_failure "${description} falhou" "$output"
  return 1
}

# Fecha o seed: imprime o resumo e devolve 1 se houve erro. Aviso não derruba.
seed_finish() {
  local seed_name="$1"
  echo "=== ${seed_name} concluído (${WARNINGS} aviso(s), ${FAILURES} falha(s)) ==="
  [[ "$FAILURES" -eq 0 ]]
}

trim() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

# Imprime cada item não vazio de uma lista separada por vírgula, um por linha.
each_item() {
  local list="${1:-}" item
  local -a items
  IFS=',' read -ra items <<<"$list"
  for item in "${items[@]+"${items[@]}"}"; do
    item=$(trim "$item")
    [[ -n "$item" ]] && printf '%s\n' "$item"
  done
  return 0
}

: "${LOCAL_APP:=playground}"
: "${LOCAL_STAGE:=local}"
: "${FLOCI_SEED_SSM_DOMAIN:=shared}"

SSM_KEY_PATTERN='^[a-z0-9][a-z0-9_-]*/[a-z0-9][a-z0-9_-]*/[A-Za-z0-9][A-Za-z0-9_.-]*$'

# Grava /<LOCAL_APP>/<LOCAL_STAGE>/<AWS_REGION>/<chave>, com chave no formato
# dominio/recurso/atributo. put-parameter --overwrite mantém a gravação idempotente.
ssm_publish() {
  local key="$1" value="$2" name

  if [[ ! "$key" =~ $SSM_KEY_PATTERN ]]; then
    fail "parâmetro SSM com chave fora do formato dominio/recurso/atributo: $key"
    return 0
  fi
  name="/${LOCAL_APP}/${LOCAL_STAGE}/${AWS_REGION}/${key}"
  if try "gravar parâmetro $name" awsl ssm put-parameter \
    --name "$name" --value "$value" --type String --overwrite; then
    log "ssm: $name"
  fi
}

# Nome do recurso no SSM: o nome real sem o prefixo <LOCAL_APP>-<LOCAL_STAGE>-,
# em minúsculas, mais o sufixo do tipo (ex.: playground-local-uploads + bucket
# vira uploads-bucket).
ssm_resource() {
  local resource_name="$1" type_suffix="$2"
  local slug="${resource_name#"${LOCAL_APP}-${LOCAL_STAGE}-"}"

  slug=$(printf '%s' "$slug" | tr '[:upper:]' '[:lower:]' | tr -c 'a-z0-9_-' '-')
  printf '%s-%s' "$slug" "$type_suffix"
}

# Imprime a URL da fila, ou nada quando ela não existe. Qualquer outro erro
# (rede, credencial, Floci fora do ar) devolve 1 com a mensagem no stderr.
sqs_url() {
  local queue_name="$1" output
  if output=$(awsl sqs get-queue-url --queue-name "$queue_name" --query QueueUrl --output text 2>&1); then
    printf '%s\n' "$output"
    return 0
  fi
  if [[ "$output" == *NonExistentQueue* ]]; then
    return 0
  fi
  printf '%s\n' "$output" >&2
  return 1
}

sqs_arn() {
  local queue_url="$1"
  awsl sqs get-queue-attributes --queue-url "$queue_url" \
    --attribute-names QueueArn --query Attributes.QueueArn --output text
}
