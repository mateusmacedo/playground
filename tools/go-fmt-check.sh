#!/usr/bin/env bash
# Falha se algum arquivo Go do diretório (padrão: o atual) está fora do gofmt.
# Uso: tools/go-fmt-check.sh [diretório]
# Chamado pelo ci.yml, pelo release.yml e pelo target `lint` dos serviços Go
# (tools/serverless).
#
# WHY: `gofmt -l` só lista e sai com 0; sem testar a saída, arquivo fora do
# padrão passaria. O `git ls-files` (versionados mais novos não ignorados) evita
# varrer node_modules, vendor e tmp, e o `xargs -r` não executa o gofmt quando
# não há arquivo Go.
set -euo pipefail

cd "${1:-.}"

unformatted="$(git ls-files -z --cached --others --exclude-standard -- '*.go' | xargs -0 -r gofmt -l)"
if [[ -n "${unformatted}" ]]; then
  echo "gofmt: arquivos fora do padrão (rode 'gofmt -w'):" >&2
  echo "${unformatted}" >&2
  exit 1
fi
