#!/usr/bin/env bash
# Confere no SonarQube Cloud as metas do ADR 0015 para um branch: gate OK,
# notas A, cobertura acima de 90% e duplicação até 3%; com a revisão, exige que
# a última análise seja desse commit.
# Uso: check-quality-gate.sh <branch> [revisão]
set -euo pipefail

readonly branch="${1:?informe o branch, por exemplo main}"
readonly revision="${2:-}"
readonly project="${SONAR_PROJECT_KEY:-mateusmacedo_playground}"
readonly host="${SONAR_HOST_URL:-https://sonarcloud.io}"
readonly min_coverage=90
readonly max_duplication=3
: "${SONAR_TOKEN:?SONAR_TOKEN não definido}"

# WHY: o token vai num arquivo de configuração do curl lido pela entrada
# padrão, e não na linha de comando, para não aparecer na lista de processos.
api() {
  local path="$1"
  printf 'header = "Authorization: Bearer %s"\n' "${SONAR_TOKEN}" |
    curl -fsS --proto '=https' --max-time 30 --retry 3 -K - "${host}${path}"
}

failures=()

check_revision() {
  local analyzed
  analyzed="$(api "/api/project_analyses/search?project=${project}&branch=${branch}&ps=1" |
    jq -r '.analyses[0].revision // ""')"
  if [[ "${analyzed}" != "${revision}" ]]; then
    failures+=("última análise de ${branch} é do commit '${analyzed:-nenhum}', e não de ${revision}; rode o sonar.yml nesse commit")
  fi
}

check_gate() {
  local status
  status="$(api "/api/qualitygates/project_status?projectKey=${project}&branch=${branch}" |
    jq -r '.projectStatus.status')"
  echo "quality gate: ${status}"
  if [[ "${status}" != "OK" ]]; then
    failures+=("quality gate ${status}")
  fi
}

check_measures() {
  local metrics='reliability_rating,security_rating,sqale_rating,security_review_rating,line_coverage,branch_coverage,duplicated_lines_density'
  local measures
  measures="$(api "/api/measures/component?component=${project}&branch=${branch}&metricKeys=${metrics}" |
    jq -r '.component.measures[] | "\(.metric)=\(.value)"')"

  local metric
  local value
  while IFS='=' read -r metric value; do
    echo "${metric}: ${value}"
    case "${metric}" in
      *_rating)
        if [[ "${value}" != "1.0" ]]; then
          failures+=("${metric} não é A (${value})")
        fi
        ;;
      line_coverage | branch_coverage)
        if ! awk -v value="${value}" -v minimum="${min_coverage}" 'BEGIN { exit !(value > minimum) }'; then
          failures+=("${metric} ${value}% não passa de ${min_coverage}%")
        fi
        ;;
      duplicated_lines_density)
        if ! awk -v value="${value}" -v maximum="${max_duplication}" 'BEGIN { exit !(value <= maximum) }'; then
          failures+=("duplicação ${value}% acima de ${max_duplication}%")
        fi
        ;;
      *)
        failures+=("métrica inesperada na resposta: ${metric}")
        ;;
    esac
  done <<<"${measures}"

  local expected=7
  local received
  received="$(grep -c '=' <<<"${measures}" || true)"
  if [[ "${received}" -ne "${expected}" ]]; then
    failures+=("o Sonar devolveu ${received} de ${expected} métricas")
  fi
}

if [[ -n "${revision}" ]]; then
  check_revision
fi
check_gate
check_measures

if [[ "${#failures[@]}" -gt 0 ]]; then
  for failure in "${failures[@]}"; do
    echo "::error::${failure}"
  done
  exit 1
fi
echo "metas do SonarQube atendidas em ${branch}"
