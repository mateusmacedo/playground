#!/usr/bin/env bash
# Seeds genéricos e idempotentes (S3, SQS com DLQ, DynamoDB, SSM), dirigidos
# pelas variáveis FLOCI_SEED_* (ver .env.example). Todo recurso semeado publica
# o próprio nome, ARN e URL no SSM, que é como os serviços o encontram.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./_common.sh
source "$SCRIPT_DIR/_common.sh"

: "${FLOCI_SEED_QUEUE_MAX_RECEIVES:=5}"

# WHY: a AWS recomenda VisibilityTimeout de pelo menos 6x o timeout da função
# consumidora, para a mensagem não reaparecer com a Lambda ainda processando.
# As Lambdas dos serviços ficam em 29 s (limite do API Gateway): 6 x 29 = 174,
# arredondado para 180.
QUEUE_VISIBILITY_TIMEOUT=180

if [[ ! "$FLOCI_SEED_QUEUE_MAX_RECEIVES" =~ ^[1-9][0-9]{0,3}$ ]] ||
  [[ "$FLOCI_SEED_QUEUE_MAX_RECEIVES" -gt 1000 ]]; then
  echo "ERRO: FLOCI_SEED_QUEUE_MAX_RECEIVES deve ser um inteiro de 1 a 1000, recebido: '${FLOCI_SEED_QUEUE_MAX_RECEIVES}'" >&2
  exit 1
fi

# NOTE: o recurso já vem com o sufixo de tipo (ver ssm_resource).
publish() {
  local resource="$1" attribute="$2" value="$3"
  ssm_publish "$FLOCI_SEED_SSM_DOMAIN/$resource/$attribute" "$value"
}

seed_bucket() {
  local bucket="$1" resource head_output
  local -a args=(--bucket "$bucket")

  # NOTE: o head-bucket não devolve código de erro nomeado, só o status HTTP:
  # 404 é "não existe"; 403 (bucket de outra conta) e o resto são falha.
  if head_output=$(awsl s3api head-bucket --bucket "$bucket" 2>&1); then
    log "bucket já existe: $bucket"
  elif [[ "$head_output" == *"(404)"* ]]; then
    # NOTE: us-east-1 é a única região que rejeita LocationConstraint.
    if [[ "$AWS_REGION" != "us-east-1" ]]; then
      args+=(--create-bucket-configuration "LocationConstraint=$AWS_REGION")
    fi
    try "criar bucket $bucket" awsl s3api create-bucket "${args[@]}" || return 0
    log "bucket criado: $bucket"
  else
    report_failure "consultar bucket $bucket falhou" "$head_output"
    return 0
  fi

  resource=$(ssm_resource "$bucket" bucket)
  publish "$resource" name "$bucket"
  publish "$resource" arn "arn:aws:s3:::$bucket"
}

# Cria a fila de mensagens mortas e a fila principal apontando para ela. A
# fila principal existente tem o redrive e o VisibilityTimeout sincronizados:
# create-queue com atributos diferentes falharia com QueueNameExists.
seed_queue() {
  local queue="$1" dlq="$1-dlq" dlq_url dlq_arn queue_url queue_arn attributes

  if ! dlq_url=$(sqs_url "$dlq" 2>&1); then
    report_failure "consultar fila $dlq falhou" "$dlq_url"
    return 0
  fi
  if [[ -n "$dlq_url" ]]; then
    log "fila já existe: $dlq"
  else
    if ! dlq_url=$(awsl sqs create-queue --queue-name "$dlq" --query QueueUrl --output text 2>&1); then
      report_failure "criar fila $dlq falhou" "$dlq_url"
      return 0
    fi
    log "fila criada: $dlq"
  fi
  if ! dlq_arn=$(sqs_arn "$dlq_url" 2>&1); then
    report_failure "ler o ARN da fila $dlq falhou, redrive de $queue não configurado" "$dlq_arn"
    return 0
  fi
  publish "$(ssm_resource "$queue" dlq)" arn "$dlq_arn"

  attributes=$(jq -nc --arg arn "$dlq_arn" --argjson max "$FLOCI_SEED_QUEUE_MAX_RECEIVES" \
    --arg visibility "$QUEUE_VISIBILITY_TIMEOUT" \
    '{VisibilityTimeout: $visibility, RedrivePolicy: ({deadLetterTargetArn: $arn, maxReceiveCount: $max} | tojson)}')
  if ! queue_url=$(sqs_url "$queue" 2>&1); then
    report_failure "consultar fila $queue falhou" "$queue_url"
    return 0
  fi
  if [[ -n "$queue_url" ]]; then
    if try "sincronizar atributos de $queue" \
      awsl sqs set-queue-attributes --queue-url "$queue_url" --attributes "$attributes"; then
      log "fila já existe: $queue (redrive -> $dlq, max $FLOCI_SEED_QUEUE_MAX_RECEIVES, visibilidade ${QUEUE_VISIBILITY_TIMEOUT}s)"
    fi
  else
    if ! queue_url=$(awsl sqs create-queue --queue-name "$queue" --attributes "$attributes" \
      --query QueueUrl --output text 2>&1); then
      report_failure "criar fila $queue falhou" "$queue_url"
      return 0
    fi
    log "fila criada: $queue (redrive -> $dlq, max $FLOCI_SEED_QUEUE_MAX_RECEIVES, visibilidade ${QUEUE_VISIBILITY_TIMEOUT}s)"
  fi

  if ! queue_arn=$(sqs_arn "$queue_url" 2>&1); then
    report_failure "ler o ARN da fila $queue falhou, parâmetros SSM não publicados" "$queue_arn"
    return 0
  fi
  publish "$(ssm_resource "$queue" queue)" url "$queue_url"
  publish "$(ssm_resource "$queue" queue)" arn "$queue_arn"
}

# Tabela mínima com chave de partição "pk" (string); esquemas próprios ficam
# a cargo do deploy de cada app.
seed_table() {
  local table="$1" table_arn resource describe_output

  if describe_output=$(awsl dynamodb describe-table --table-name "$table" 2>&1); then
    log "tabela já existe: $table"
  elif [[ "$describe_output" == *ResourceNotFoundException* ]]; then
    try "criar tabela $table" awsl dynamodb create-table \
      --table-name "$table" \
      --attribute-definitions AttributeName=pk,AttributeType=S \
      --key-schema AttributeName=pk,KeyType=HASH \
      --billing-mode PAY_PER_REQUEST || return 0
    log "tabela criada: $table"
  else
    report_failure "consultar tabela $table falhou" "$describe_output"
    return 0
  fi

  if ! table_arn=$(awsl dynamodb describe-table --table-name "$table" \
    --query Table.TableArn --output text 2>&1); then
    report_failure "ler o ARN da tabela $table falhou, parâmetros SSM não publicados" "$table_arn"
    return 0
  fi
  resource=$(ssm_resource "$table" table)
  publish "$resource" name "$table"
  publish "$resource" arn "$table_arn"
}

# Entrada no formato <dominio>/<recurso>/<atributo>=<valor>; o nome final é
# /<LOCAL_APP>/<LOCAL_STAGE>/<AWS_REGION>/<dominio>/<recurso>/<atributo>.
seed_ssm_parameter() {
  local entry="$1"

  if [[ "$entry" != *=* ]]; then
    fail "parâmetro SSM sem o formato dominio/recurso/atributo=valor: $entry"
    return 0
  fi
  ssm_publish "$(trim "${entry%%=*}")" "$(trim "${entry#*=}")"
}

echo "=== 01-generic: S3, SQS, DynamoDB, SSM ==="
while IFS= read -r item; do seed_bucket "$item"; done < <(each_item "${FLOCI_SEED_BUCKETS:-}")
while IFS= read -r item; do seed_queue "$item"; done < <(each_item "${FLOCI_SEED_QUEUES:-}")
while IFS= read -r item; do seed_table "$item"; done < <(each_item "${FLOCI_SEED_TABLES:-}")
while IFS= read -r item; do seed_ssm_parameter "$item"; done < <(each_item "${FLOCI_SEED_SSM_PARAMETERS:-}")
seed_finish 01-generic
