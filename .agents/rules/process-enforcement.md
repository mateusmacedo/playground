---
paths:
  - "apps/**"
  - "tools/**"
  - "packages/**"
  - "infra/**"
---

# Processo e qualidade

Orientações que valem para qualquer alteração de código. Convenções gerais, níveis (OBRIGATÓRIO, RECOMENDADO, OPCIONAL), roadmap, comandos e a validação obrigatória estão no `AGENTS.md` da raiz.

## Antes de escrever

- **Reutilize**: busque implementação parecida no repositório (`rg`, `pnpm nx show projects`, `pnpm nx show project <nome> --json`) antes de criar.
- Decisão de arquitetura (runtime, dono de um recurso, camada, nova ferramenta de base) vai para um ADR em `docs/adr/`, no modelo de `docs/adr/TEMPLATE.md`, junto com a mudança. Número de quatro dígitos, nunca reutilizado.
- Refatoração ampla (vários projetos ou camadas): alinhe o escopo com o usuário e liste os arquivos afetados antes de começar. Use `pnpm nx show projects --affected` para ver o raio de impacto.

## Mudança que cruza fronteira

- Serviço que precisa de recurso de dono Terraform muda **dois lugares no mesmo PR**: o módulo e o `serverless.yml` que lê o parâmetro SSM. No ambiente local, o Terraform publica a plataforma (L1) e os serviços de container (L4); fila, tabela e bucket compartilhados ainda vêm do seed do `infra/local`, que então é o segundo lugar. O SSM é o contrato.
- Parâmetro novo segue `/playground/<stage>/<região>/<domínio>/<recurso>/<atributo>`.
- Ao mudar convenção, estrutura ou comando, atualize na mesma entrega a documentação que a descreve (`docs/`, `README.md` do projeto, o `AGENTS.md` do escopo certo).

## Validação conforme o que mudou

Além do que o `AGENTS.md` da raiz exige ao fim de toda tarefa:

1. `pnpm nx sync:check` se mexeu em `tsconfig`, referências ou dependências entre projetos;
2. `bash tools/lint-actions.sh` se mexeu em `.github/`;
3. `pnpm nx validate infra-local` se mexeu em `infra/local`;
4. `node tools/ai/check-instructions.mjs` se mexeu em `AGENTS.md`, `CLAUDE.md`, `.agents/` ou `.claude/`.
