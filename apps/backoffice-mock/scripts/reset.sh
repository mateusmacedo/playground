#!/usr/bin/env bash
# Volta os dados do mock ao estado inicial, pela API administrativa do Mockoon.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

# WHY: dentro do container a porta é fixa e o token já está no ambiente; assim
# o script não precisa ler o .env nem depender de curl no host.
docker compose exec -T mockoon node -e "
fetch('http://127.0.0.1:4010/mockoon-admin/data-buckets/purge', {
  method: 'POST',
  headers: { authorization: 'Bearer ' + process.env.MOCKOON_ADMIN_API_TOKEN },
})
  .then((response) => process.exit(response.ok ? 0 : 1))
  .catch(() => process.exit(1));
"
echo "ok: dados do mock de volta ao estado inicial"
