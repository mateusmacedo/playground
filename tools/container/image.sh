#!/usr/bin/env bash
# Build, execução local e push no ECR do Floci das imagens dos serviços.
# Imagem: playground/<projeto>:<tag>, com a tag de image-tag.sh (ADR 0008).
# Repositório no ECR: playground-<projeto>, criado pelo Terraform.

set -euo pipefail

readonly IMAGE_NAMESPACE="playground"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR

cd "$(git rev-parse --show-toplevel)"

die() {
  echo "erro: $*" >&2
  exit 1
}

usage() {
  cat >&2 <<'EOF'
uso:
  image.sh build <projeto> <dockerfile> [opções do docker build]
  image.sh run <projeto>
  image.sh push-floci <projeto>
EOF
  exit 2
}

# WHY: define TAG e LOCAL_REF em variáveis globais, e não por command
# substitution: um `die` dentro de $(...) só encerra o subshell, e o script
# seguiria com uma referência de imagem incompleta.
resolve_image() {
  local project="$1"
  [[ "${project}" =~ ^[a-z0-9][a-z0-9-]*$ ]] || die "nome de projeto inválido: '${project}'"
  TAG="$("${SCRIPT_DIR}/image-tag.sh")"
  LOCAL_REF="${IMAGE_NAMESPACE}/${project}:${TAG}"
}

cmd_build() {
  local project="$1" dockerfile="$2" revision
  shift 2
  resolve_image "${project}"
  [[ -f "${dockerfile}" ]] || die "Dockerfile não encontrado: ${dockerfile}"
  revision="$(git rev-parse HEAD)"
  docker build \
    --file "${dockerfile}" \
    --tag "${LOCAL_REF}" \
    --build-arg "REVISION=${revision}" \
    "$@" \
    .
  echo "imagem: ${LOCAL_REF}"
}

cmd_run() {
  local project="$1"
  resolve_image "${project}"
  docker run --rm --publish "127.0.0.1:${HOST_PORT:-8080}:8080" "${LOCAL_REF}"
}

# WHY: o script só fala com o Floci. Credenciais reais do ambiente nunca seguem
# para o endpoint, e um endpoint que não seja loopback é recusado.
use_floci_endpoint() {
  FLOCI_ENDPOINT="${AWS_ENDPOINT_URL:-http://localhost:4566}"
  case "${FLOCI_ENDPOINT}" in
  http://localhost:* | http://127.0.0.1:* | http://\[::1\]:*) ;;
  *) die "endpoint '${FLOCI_ENDPOINT}' não é o Floci local (esperado http://localhost:<porta>)" ;;
  esac
  unset AWS_SESSION_TOKEN AWS_PROFILE
  export AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test
  export AWS_DEFAULT_REGION=us-east-1 AWS_REGION=us-east-1 AWS_PAGER=""
}

floci_aws() {
  aws --cli-connect-timeout 5 --cli-read-timeout 30 \
    --endpoint-url "${FLOCI_ENDPOINT}" "$@"
}

# WHY: o login e o push no registry do Floci falham de forma transitória
# (registry subindo, conexão resetada) e são idempotentes, então valem 3
# tentativas com backoff exponencial e jitter. Registra só o desfecho: uma
# linha ao desistir ou ao precisar de mais de uma tentativa.
retry() {
  local max_attempts=3 delay=2 attempt command_name="$1"
  for ((attempt = 1; attempt <= max_attempts; attempt++)); do
    if "$@"; then
      ((attempt == 1)) || echo "aviso: '${command_name}' passou na tentativa ${attempt} de ${max_attempts}." >&2
      return 0
    fi
    ((attempt == max_attempts)) || sleep "$((delay + RANDOM % 2))"
    delay=$((delay * 2))
  done
  echo "erro: '${command_name}' falhou nas ${max_attempts} tentativas, desistindo." >&2
  return 1
}

ecr_login() {
  local registry="$1"
  floci_aws ecr get-login-password |
    docker login --username AWS --password-stdin "${registry}"
}

docker_push() {
  local image_ref="$1"
  docker push "${image_ref}"
}

cmd_push_floci() {
  local project="$1" repository repository_uri mutability lookup
  resolve_image "${project}"
  use_floci_endpoint
  repository="${IMAGE_NAMESPACE}-${project}"

  docker image inspect "${LOCAL_REF}" >/dev/null 2>&1 ||
    die "imagem ${LOCAL_REF} não existe localmente; rode 'pnpm nx docker:build ${project}'"

  # WHY: o repositório é do Terraform (dono único do recurso); se não existe,
  # criar aqui geraria um segundo dono.
  if ! lookup="$(floci_aws ecr describe-repositories --repository-names "${repository}" \
    --query 'repositories[0].[repositoryUri,imageTagMutability]' --output text 2>&1)"; then
    [[ "${lookup}" == *RepositoryNotFoundException* ]] &&
      die "repositório '${repository}' não existe no ECR do Floci (${FLOCI_ENDPOINT}); crie-o com 'pnpm nx run infra-local:local:provision' (ou só a plataforma: 'pnpm nx run infra-local-platform:apply') e rode de novo"
    die "falha ao consultar o ECR do Floci em ${FLOCI_ENDPOINT}: ${lookup}"
  fi
  read -r repository_uri mutability <<<"${lookup}"

  # WHY: no Floci, repositório IMMUTABLE recusa até o push do mesmo manifest. A
  # tag identifica o conteúdo (image-tag.sh), então a já publicada vale como feita.
  if [[ "${mutability}" == "IMMUTABLE" ]] &&
    floci_aws ecr describe-images --repository-name "${repository}" \
      --image-ids "imageTag=${TAG}" >/dev/null 2>&1; then
    echo "aviso: ${repository_uri}:${TAG} já existe em repositório IMMUTABLE; nada a publicar." >&2
    return 0
  fi

  retry ecr_login "${repository_uri%%/*}"

  docker tag "${LOCAL_REF}" "${repository_uri}:${TAG}"
  retry docker_push "${repository_uri}:${TAG}"

  floci_aws ecr describe-images --repository-name "${repository}" \
    --image-ids "imageTag=${TAG}" \
    --query 'imageDetails[0].{digest:imageDigest,tags:imageTags,bytes:imageSizeInBytes}' \
    --output json
  echo "publicada: ${repository_uri}:${TAG}"
}

main() {
  local command="${1:-}"
  [[ $# -gt 0 ]] && shift
  case "${command}" in
  build)
    [[ $# -ge 2 ]] || usage
    cmd_build "$@"
    ;;
  run)
    [[ $# -eq 1 ]] || usage
    cmd_run "$@"
    ;;
  push-floci)
    [[ $# -eq 1 ]] || usage
    cmd_push_floci "$@"
    ;;
  *) usage ;;
  esac
}

main "$@"
