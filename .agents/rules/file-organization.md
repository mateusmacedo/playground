---
paths:
  - "apps/**"
  - "tools/**"
  - "packages/**"
  - "infra/**"
---

# Organização de arquivos

A estrutura de topo do repositório está no `AGENTS.md` da raiz ("Estrutura"); a de dentro de cada projeto, no `AGENTS.md` dele.

## Colocalização

1. Crie função, tipo e utilitário **perto de quem usa**.
2. Não suba para uma camada compartilhada enquanto houver um só consumidor.
3. Promova quando **dois ou mais** módulos de pastas diferentes dependerem do código: no painel, para `src/shared`; entre projetos, para uma lib em `packages/`, ligada por dependência de workspace do pnpm (não por `paths` no `tsconfig`).
4. Um conceito por arquivo. Sem arquivo solto com lógica fora de um módulo que faça sentido.

## Regras

- **Sem barrel files** (`index.ts` que só reexporta) dentro de um projeto: importe do arquivo de origem. Reexport só na API pública de uma lib.
- A dependência aponta para dentro: entrypoint depende do núcleo, nunca o contrário.
- Ao mover ou renomear, apague o que ficou órfão com `trash`.
