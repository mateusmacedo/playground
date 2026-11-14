#!/usr/bin/env bash
# Imprime a tag imutável das imagens dos serviços: `sha-<commit curto>` ou, com
# as entradas do build alteradas, `sha-<commit curto>-dirty-<hash do conteúdo>`.
# IMAGE_TAG no ambiente sobrescreve. O stdout é só a tag; avisos vão ao stderr.

set -euo pipefail

readonly SHORT_SHA_LENGTH=7
readonly CONTENT_HASH_LENGTH=12

# WHY: só o que entra nas imagens conta para "sujo" e para o hash. Árvore
# inteira faria qualquer edição em docs/ ou infra/ trocar a tag entre o build e
# o apply, e o apply pediria ao ECR uma tag que ninguém publicou. Os Markdown
# dos serviços não entram em imagem nenhuma.
readonly BUILD_INPUTS=(
  apps/services
  build.gradle
  settings.gradle
  gradle.properties
  gradle
  gradlew
  tools/java
  .dockerignore
  ':(exclude)*.md'
)

cd "$(git rev-parse --show-toplevel)"

die() {
  echo "erro: $*" >&2
  exit 1
}

# WHY: o hash cobre o caminho e o conteúdo de cada arquivo rastreado ou novo
# (fora do .gitignore); o mesmo conteúdo dá a mesma tag, e o re-push de uma tag
# já publicada em repositório IMMUTABLE vale como feito.
content_hash() {
  git ls-files -z --cached --others --exclude-standard -- "${BUILD_INPUTS[@]}" |
    while IFS= read -r -d '' path; do
      if [[ -f "${path}" ]]; then
        printf '%s %s\n' "${path}" "$(git hash-object -- "${path}")"
      fi
    done |
    git hash-object --stdin |
    cut -c1-"${CONTENT_HASH_LENGTH}"
}

main() {
  local tag short_sha hash
  if [[ -n "${IMAGE_TAG:-}" ]]; then
    tag="${IMAGE_TAG}"
  else
    short_sha="$(git rev-parse --short="${SHORT_SHA_LENGTH}" HEAD)"
    tag="sha-${short_sha}"
    if [[ -n "$(git status --porcelain --untracked-files=all -- "${BUILD_INPUTS[@]}")" ]]; then
      hash="$(content_hash)"
      tag="${tag}-dirty-${hash}"
      echo "aviso: entradas do build alteradas desde o commit ${short_sha}; tag ${tag}." >&2
    fi
  fi
  [[ "${tag}" =~ ^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$ ]] || die "tag inválida: '${tag}'"
  echo "${tag}"
}

main
