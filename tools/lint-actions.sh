#!/usr/bin/env bash
# Verifica os workflows do GitHub Actions (modos: --help).
# NOTE: as versões pinadas vêm de .github/actionlint.versions (mantido pelo
# Renovate); ACTIONLINT_VERSION e ACTIONLINT_REF_SHA no ambiente têm precedência.

set -euo pipefail

# WHY: versão do Renovate pinada para o schema não driftar. O Renovate a mantém
# via customManager regex no renovate.json (casa RENOVATE_PIN_VERSION="X.Y.Z").
RENOVATE_PIN_VERSION="44.222.5"

repo_root() {
  git rev-parse --show-toplevel 2>/dev/null || pwd
}

ROOT="$(repo_root)"
VERSIONS_FILE="${ROOT}/.github/actionlint.versions"

# Carrega ACTIONLINT_VERSION/ACTIONLINT_REF_SHA do arquivo se não vieram do ambiente.
if [[ -f "${VERSIONS_FILE}" ]]; then
  while IFS='=' read -r key value; do
    case "${key}" in
    ACTIONLINT_VERSION) : "${ACTIONLINT_VERSION:=${value}}" ;;
    ACTIONLINT_REF_SHA) : "${ACTIONLINT_REF_SHA:=${value}}" ;;
    esac
  done <"${VERSIONS_FILE}"
fi

require_actionlint_vars() {
  if [[ -z "${ACTIONLINT_VERSION:-}" || -z "${ACTIONLINT_REF_SHA:-}" ]]; then
    echo "ERRO: ACTIONLINT_VERSION e ACTIONLINT_REF_SHA são obrigatórios. Defina via env ou em ${VERSIONS_FILE}." >&2
    exit 2
  fi
}

# Política de pinning: @<sha de 40 hex> + " # vN.N.N" (semver completo, com
# pre-release e build opcionais).
readonly SHA40='[A-Fa-f0-9]{40}'
readonly SEMVER_COMMENT='v[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?'
readonly PINNED_REF_REGEX="@${SHA40}[[:space:]]+#[[:space:]]+${SEMVER_COMMENT}[[:space:]]*\$"
# Linhas `uses: dono/repo@ref`; as actions locais (`./...`) ficam de fora.
readonly THIRD_PARTY_USES_REGEX='uses:[[:space:]]+[^./][^[:space:]]+@'

check_pinning() {
  local result=0 line uses_lines grep_status=0
  # WHY: o grep sai com 1 quando nada casa (ok); qualquer outro código é erro de
  # leitura, e não pode virar "nenhuma violação".
  uses_lines="$(grep -REn "${THIRD_PARTY_USES_REGEX}" \
    "${ROOT}/.github/workflows" "${ROOT}/.github/actions")" || grep_status=$?
  if [[ "${grep_status}" -gt 1 ]]; then
    echo "ERRO: grep falhou (exit ${grep_status}) ao ler .github/workflows e .github/actions." >&2
    return 2
  fi

  while IFS= read -r line; do
    [[ -z "${line}" ]] && continue
    if [[ ! "${line}" =~ ${PINNED_REF_REGEX} ]]; then
      echo "VIOLAÇÃO: ${line}" >&2
      result=1
    fi
  done <<<"${uses_lines}"

  if [[ "${result}" -ne 0 ]]; then
    echo "" >&2
    echo "Política: Actions de terceiros devem usar @<sha40> + comentário # vN.N.N (semver completo)." >&2
    return 1
  fi
  echo "check-pinning OK: todas as Actions de terceiros pinadas por SHA40 + comentário # vN.N.N."
}

download_actionlint() {
  require_actionlint_vars
  local bin_dir="${ROOT}/tmp/actionlint-bin/${ACTIONLINT_VERSION}-${ACTIONLINT_REF_SHA}"
  mkdir -p "${bin_dir}"
  if [[ ! -x "${bin_dir}/actionlint" ]]; then
    local url="https://raw.githubusercontent.com/rhysd/actionlint/${ACTIONLINT_REF_SHA}/scripts/download-actionlint.bash"
    local installer="${bin_dir}/download-actionlint.bash"
    # WHY: baixar para um arquivo (e não `bash <(curl ...)`) deixa o curl falhar
    # com timeout e retentativa, e permite conferir o conteúdo antes de executar.
    if ! curl -fsSL --connect-timeout 10 --max-time 60 --retry 3 -o "${installer}" "${url}" ||
      [[ ! -s "${installer}" || "$(head -c 2 "${installer}")" != '#!' ]]; then
      echo "ERRO: falha ao baixar o instalador do actionlint (ref ${ACTIONLINT_REF_SHA:0:7})." >&2
      exit 1
    fi
    if ! (cd "${bin_dir}" && bash "${installer}" "${ACTIONLINT_VERSION}" >&2); then
      echo "ERRO: falha ao instalar actionlint ${ACTIONLINT_VERSION} (ref ${ACTIONLINT_REF_SHA:0:7})." >&2
      exit 1
    fi
  fi
  if [[ ! -x "${bin_dir}/actionlint" ]]; then
    echo "ERRO: binário actionlint não encontrado em ${bin_dir} após download." >&2
    exit 1
  fi
  echo "${bin_dir}/actionlint"
}

run_syntax() {
  local bin
  bin="$(download_actionlint)"
  (cd "${ROOT}" && "${bin}" -color)
}

validate_renovate() {
  (cd "${ROOT}" && pnpm dlx --package="renovate@${RENOVATE_PIN_VERSION}" -- renovate-config-validator renovate.json)
}

usage() {
  cat <<'EOF'
Usage: tools/lint-actions.sh [--all|--check-pinning|--syntax-only|--validate-renovate]

  --all (default)        actionlint + check-pinning + validate renovate.json
  --check-pinning        apenas política de pinning (rápido)
  --syntax-only          apenas actionlint
  --validate-renovate    apenas renovate-config-validator
EOF
}

main() {
  local mode="${1:---all}"
  case "${mode}" in
  --all)
    run_syntax
    check_pinning
    validate_renovate
    ;;
  --check-pinning)
    check_pinning
    ;;
  --syntax-only)
    run_syntax
    ;;
  --validate-renovate)
    validate_renovate
    ;;
  -h | --help)
    usage
    ;;
  *)
    echo "Modo desconhecido: ${mode}" >&2
    usage >&2
    exit 2
    ;;
  esac
}

main "$@"
