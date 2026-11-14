---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

# Limites de tamanho

Os números são heurísticas de coesão, não metas: o limite certo depende da complexidade do código. Os limites de Go estão na rule `services-go` de `apps/services`.

| Tipo                    | Referência  | Ao ultrapassar                                |
| ----------------------- | ----------- | --------------------------------------------- |
| Arquivo `.ts` ou `.tsx` | ~300 linhas | Extrair módulo, hook, subcomponente ou função |
| Função ou componente    | ~80 linhas  | Dividir por papel (validar, executar, mapear) |

- Ao criar ou refatorar, confira se o arquivo continua coeso. Se passar, **avise e proponha** a decomposição.
- Não quebre módulo de forma mecânica sem alinhar: divisão por tamanho puro costuma piorar a coesão.
- Não vale para arquivo gerado, `pnpm-lock.yaml`, fixtures e dados de teste.
