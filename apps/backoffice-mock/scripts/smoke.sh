#!/usr/bin/env bash
# Fumaça do mock: confere, pelo endereço publicado no host, o que o painel e o
# e2e esperam do container no ar. Volta os dados ao estado inicial no começo e
# no fim, então não rode com dados que você queira manter no mock.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

# WHY: o compose lê o .env sozinho; o script precisa enxergar a mesma porta e o
# mesmo token, e a variável do ambiente vence o arquivo, como no compose.
setting() {
  local name="$1" fallback="$2" value="${!1:-}"
  if [[ -z "$value" && -f .env ]]; then
    value="$(grep -E "^${name}=" .env | tail -n 1 | cut -d= -f2- || true)"
  fi
  echo "${value:-$fallback}"
}

PORT="$(setting BACKOFFICE_MOCK_PORT 4010)"
TOKEN="$(setting BACKOFFICE_MOCK_ADMIN_TOKEN local-mock-token)"
BASE="http://127.0.0.1:${PORT}"
JSON=(-H 'Content-Type: application/json')
FAILURES=0
STATUS=''
SECONDS_TAKEN=''
HEADERS=''
BODY=''

# call <método> <caminho> [argumentos do curl]: preenche STATUS, SECONDS_TAKEN,
# HEADERS e BODY.
call() {
  local method="$1" path="$2" raw summary
  shift 2
  raw="$(curl -sS -i --max-time 30 -X "$method" "$@" \
    -w '\n@@%{http_code} %{time_total}' "${BASE}${path}" | tr -d '\r')" || raw='@@000 0'
  summary="${raw##*@@}"
  raw="${raw%$'\n'@@*}"
  STATUS="${summary%% *}"
  SECONDS_TAKEN="${summary##* }"
  HEADERS="${raw%%$'\n\n'*}"
  BODY=''
  if [[ "$raw" == *$'\n\n'* ]]; then
    BODY="${raw#*$'\n\n'}"
  fi
}

header() {
  printf '%s\n' "$HEADERS" | grep -i "^$1:" | tail -n 1 | sed 's/^[^:]*: *//' || true
}

report() {
  local outcome="$1" label="$2" detail="${3:-}"
  if [[ "$outcome" == ok ]]; then
    printf 'ok     %s  %s\n' "$STATUS" "$label"
    return
  fi
  printf 'FALHA  %s  %s (%s)\n' "$STATUS" "$label" "$detail"
  FAILURES=$((FAILURES + 1))
}

# expect <descrição> <status> [<cabeçalho> <valor>]: confere a última resposta.
expect() {
  local label="$1" status="$2" name="${3:-}" value="${4:-}" actual
  if [[ "$STATUS" != "$status" ]]; then
    report falha "$label" "esperado ${status}"
    return
  fi
  if [[ -n "$name" ]]; then
    actual="$(header "$name")"
    if [[ "$actual" != "$value" ]]; then
      report falha "$label" "${name} veio [${actual}], esperado [${value}]"
      return
    fi
    label="${label}  ${name}: ${actual:-(ausente)}"
  fi
  report ok "$label"
}

expect_problem() {
  local label="$1" status="$2"
  expect "$label" "$status" Content-Type 'application/problem+json; charset=utf-8'
}

expect_body() {
  local label="$1" text="$2"
  if [[ "$BODY" == *"$text"* ]]; then
    report ok "$label"
    return
  fi
  report falha "$label" "o corpo não tem ${text}"
}

expect_no_body() {
  local label="$1" text="$2"
  if [[ "$BODY" == *"$text"* ]]; then
    report falha "$label" "o corpo tem ${text}"
    return
  fi
  report ok "$label"
}

purge() {
  call POST /mockoon-admin/data-buckets/purge -H "Authorization: Bearer ${TOKEN}"
}

board() {
  local id="$1" name="$2" revision="$3"
  printf '{"id":"%s","name":"%s","revision":%s,"schemaVersion":3,"board":{"lanes":[{"id":"todo","title":"A fazer","cards":[]}],"archive":[],"labels":[],"nextNumber":1,"config":{"keyPrefix":"QD"}}}' \
    "$id" "$name" "$revision"
}

definition() {
  local id="$1" name="$2" revision="$3"
  printf '{"id":"%s","revision":%s,"schemaVersion":1,"definition":{"id":"%s","name":"%s","createdAt":"2026-11-26T12:00:00.000Z","updatedAt":"2026-11-26T12:00:00.000Z","draftText":null,"versions":[]}}' \
    "$id" "$revision" "$id" "$name"
}

# NOTE: cinco anexos de 500 KB como `data:` URL, o maior quadro que o painel
# costuma gravar; passa de 3 MB.
large_board() {
  node -e '
    const url = `data:application/octet-stream;base64,${"A".repeat(680000)}`;
    const attachments = [1, 2, 3, 4, 5].map((n) => ({
      id: `attachment-${n}`,
      name: `arquivo-${n}.bin`,
      url,
      at: "2026-11-26T12:00:00.000Z",
      size: 510000,
    }));
    const card = { id: "item-1", title: "Item 1", number: 1, attachments };
    const board = {
      lanes: [{ id: "todo", title: "A fazer", cards: [card] }],
      archive: [],
      labels: [],
      nextNumber: 2,
      config: { keyPrefix: "QD" },
    };
    const document = { id: "board-2", name: "Suporte", revision: 3, schemaVersion: 3, board };
    process.stdout.write(JSON.stringify(document));
  '
}

echo "Fumaça do mock em ${BASE}"

call GET /health
if [[ "$STATUS" != 200 ]]; then
  echo "ERRO: o mock não respondeu em ${BASE}. Suba com: pnpm nx run backoffice-mock:up" >&2
  exit 1
fi
expect 'GET /health' 200

echo '--- estado inicial e API administrativa'
call POST /mockoon-admin/data-buckets/purge
expect 'purge sem token é recusado' 401
purge
expect 'purge com o token volta aos dados iniciais' 200
call GET /boards
expect 'GET /boards' 200 ETag ''
expect_body 'a lista traz o quadro inicial' '"id":"board-1","name":"Quadro principal","revision":1'
call GET /process-definitions
expect 'GET /process-definitions' 200
expect_body 'a lista traz o processo inicial' '"id":"process-1","revision":1'

echo '--- quadros: leitura, criação e gravação com revisão'
call GET /boards/board-1
expect 'GET /boards/board-1' 200 ETag '"1"'
call GET /boards/board-9
expect_problem 'GET de quadro que não existe' 404
call POST /boards "${JSON[@]}" -d "$(board board-2 Suporte 1)"
expect 'POST /boards cria com revision 1' 201 ETag '"1"'
call POST /boards "${JSON[@]}" -d "$(board board-2 Suporte 1)"
expect_problem 'POST com id que já existe' 422
call POST /boards "${JSON[@]}" -d "$(board board-3 Vendas 2)"
expect_problem 'POST com revision diferente de 1' 422
call POST /boards "${JSON[@]}" -d '{"name":"Sem id"}'
expect_problem 'POST sem os campos obrigatórios' 422
call POST /boards "${JSON[@]}" -d 'isto não é JSON'
expect_problem 'POST com corpo que não é JSON' 400
call PUT /boards/board-2 "${JSON[@]}" -d "$(board board-2 Atendimento 2)"
expect_problem 'PUT sem If-Match' 428
call PUT /boards/board-9 "${JSON[@]}" -H 'If-Match: "1"' -d "$(board board-9 Outro 2)"
expect_problem 'PUT em quadro que não existe' 404
call PUT /boards/board-2 "${JSON[@]}" -H 'If-Match: "1"' -d "$(board board-2 Atendimento 2)"
expect 'PUT com a revisão lida grava a revisão 2' 200 ETag '"2"'
call GET /boards/board-2
expect 'GET devolve a revisão gravada' 200 ETag '"2"'
expect_body 'GET devolve o documento gravado' '"name":"Atendimento","revision":2'
call PUT /boards/board-2 "${JSON[@]}" -H 'If-Match: "1"' -d "$(board board-2 Atrasado 2)"
expect_problem 'PUT com revisão desatualizada' 412
call PUT /boards/board-2 "${JSON[@]}" -H 'If-Match: "2"' -d '{"name":'
expect_problem 'PUT com corpo que não é JSON' 400
call PUT /boards/board-2 "${JSON[@]}" -H 'If-Match: "2"' -d "$(board board-2 Atendimento 7)"
expect_problem 'PUT com revision que não é a lida mais 1' 422
call PUT /boards/board-2 "${JSON[@]}" -H 'If-Match: "2"' -d "$(board board-7 Atendimento 3)"
expect_problem 'PUT com id diferente do endereço' 422
call PUT /boards/board-2 "${JSON[@]}" -H 'If-Match: "2"' -H 'Expect:' --data-binary @- < <(large_board)
expect 'PUT com corpo de mais de 3 MB' 200 ETag '"3"'
if ((${#BODY} > 3000000)); then
  report ok "o corpo grande volta inteiro (${#BODY} caracteres)"
else
  report falha 'o corpo grande volta inteiro' "vieram ${#BODY} caracteres"
fi

echo '--- quadros: remoção e operações fora do contrato'
call DELETE /boards/board-2
expect 'DELETE /boards/board-2' 204
call GET /boards/board-2
expect_problem 'GET depois da remoção' 404
call DELETE /boards/board-2
expect_problem 'DELETE de quadro que não existe' 404
call PATCH /boards/board-1 "${JSON[@]}" -d '{"name":"Outro"}'
expect_problem 'PATCH é recusado' 405
call DELETE /boards
expect_problem 'DELETE da coleção é recusado' 405

echo '--- definições de processo'
call GET /process-definitions/process-1
expect 'GET /process-definitions/process-1' 200 ETag '"1"'
call GET /process-definitions/process-9
expect_problem 'GET de definição que não existe' 404
call POST /process-definitions "${JSON[@]}" -d "$(definition process-2 Atendimento 1)"
expect 'POST /process-definitions cria com revision 1' 201 ETag '"1"'
call PUT /process-definitions/process-2 "${JSON[@]}" -d "$(definition process-2 Triagem 2)"
expect_problem 'PUT sem If-Match' 428
call PUT /process-definitions/process-2 "${JSON[@]}" -H 'If-Match: "1"' -d "$(definition process-2 Triagem 2)"
expect 'PUT com a revisão lida grava a revisão 2' 200 ETag '"2"'
call PUT /process-definitions/process-2 "${JSON[@]}" -H 'If-Match: "1"' -d "$(definition process-2 Atrasado 2)"
expect_problem 'PUT com revisão desatualizada' 412
call PUT /process-definitions/process-9 "${JSON[@]}" -H 'If-Match: "1"' -d "$(definition process-9 Outro 2)"
expect_problem 'PUT em definição que não existe' 404
call DELETE /process-definitions/process-2
expect_problem 'DELETE de definição é recusado (o catálogo só arquiva)' 405

echo '--- CORS'
call OPTIONS /boards/board-1 -H 'Origin: http://localhost:3000' \
  -H 'Access-Control-Request-Method: PUT' \
  -H 'Access-Control-Request-Headers: content-type,if-match,x-mock-scenario'
expect 'preflight libera If-Match e X-Mock-Scenario' 200 \
  Access-Control-Allow-Headers 'Content-Type, If-Match, X-Mock-Scenario'
expect 'preflight libera a origem' 200 Access-Control-Allow-Origin '*'
call GET /boards/board-1 -H 'Origin: http://localhost:3000'
expect 'a resposta expõe o ETag ao navegador' 200 Access-Control-Expose-Headers ETag

echo '--- cenários do X-Mock-Scenario'
call GET /boards -H 'X-Mock-Scenario: error'
expect_problem 'error' 500
call GET /process-definitions/process-1 -H 'X-Mock-Scenario: unavailable'
expect_problem 'unavailable' 503
call GET /boards/board-1 -H 'X-Mock-Scenario: slow'
if awk -v taken="$SECONDS_TAKEN" 'BEGIN { exit !(taken >= 1.4) }'; then
  expect "slow responde depois de ${SECONDS_TAKEN} s" 200 ETag '"1"'
else
  report falha 'slow' "respondeu em ${SECONDS_TAKEN} s"
fi

echo '--- semeadura (só do mock) e volta ao estado inicial'
call PUT /boards "${JSON[@]}" -d "[$(board board-5 Semeado 1)]"
expect 'PUT /boards troca a coleção inteira' 200
call GET /boards
expect_body 'a lista traz só o que foi semeado' '[{"id":"board-5"'
call PUT /boards "${JSON[@]}" -d '{"id":"board-5"}'
expect_problem 'PUT /boards com corpo que não é lista de documentos' 422
purge
expect 'purge' 200
call GET /boards
expect_body 'o quadro inicial voltou' '"id":"board-1","name":"Quadro principal","revision":1'
expect_no_body 'o quadro semeado saiu' '"id":"board-5"'
call GET /process-definitions
expect_no_body 'a definição criada saiu' '"id":"process-2"'

if ((FAILURES > 0)); then
  echo "ERRO: ${FAILURES} caso(s) falharam." >&2
  exit 1
fi
echo 'ok: o mock responde como o contrato e o README descrevem'
