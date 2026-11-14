# ADR 0012: Instruções de IA por projeto

- **Status**: Aceito
- **Data**: 2026-11-14

## Contexto

As instruções de IA moravam todas na raiz. O `AGENTS.md` tinha 220 linhas, acima da meta de 200 que a documentação do Claude Code recomenda, e misturava o geral com seções só do backoffice, dos serviços, do Java e do Floci. As 9 rules de `.agents/rules/` tinham `paths:` largos e misturavam stacks: a `code-patterns` cobria a arquitetura de serviço, o TypeScript de serviço e do painel e o Go. As 14 skills `skill-*` ficavam na raiz e entravam na lista de toda sessão, mesmo quando o trabalho era só no painel.

A documentação do Claude Code ([memory](https://code.claude.com/docs/en/memory), [skills](https://code.claude.com/docs/en/skills) e [sub-agents](https://code.claude.com/docs/en/sub-agents)) diz:

- Quando existe `CLAUDE.md`, o Claude Code lê só ele e ignora o `AGENTS.md`. Por isso o `CLAUDE.md` precisa importar o `AGENTS.md` com `@AGENTS.md`.
- O `CLAUDE.md` e as rules de `.claude/rules` de uma subpasta carregam sob demanda, quando o Claude lê um arquivo daquela subárvore.
- Para o `CLAUDE.md`, a meta é ficar abaixo de 200 linhas. Para o `SKILL.md`, abaixo de 500. O limite sob demanda é de 40 mil caracteres por arquivo.
- A descoberta de `.claude/agents` em subpasta não está documentada.

Codex, Cursor e Copilot leem `AGENTS.md` aninhado nativamente.

**Teste prático (2026-11-14).** Montamos uma sonda com tokens únicos em `apps/backoffice-e2e/` e `apps/services/` e rodamos `claude -p` (Sonnet) na raiz. Os resultados:

1. **`CLAUDE.md` com `@AGENTS.md` em subpasta.** O `AGENTS.md` importado carregou só depois que o Claude leu um arquivo da pasta, como `system-reminder`. Antes da leitura, nenhum token aparecia.
2. **Glob relativo de rule.** A rule em `apps/backoffice-e2e/.claude/rules` com `paths: ["src/**"]` carregou. A mesma rule com o glob relativo à raiz (`apps/backoffice-e2e/src/**`) não carregou. Ou seja, os globs são relativos à pasta que contém o `.claude`.
3. **Ancestrais intermediários.** Ler `apps/services/example-quarkus/core/build.gradle` carregou os `CLAUDE.md` de `apps/services/` e de `apps/services/example-quarkus/`. Carregou também a rule de `apps/services/.claude/rules` com `paths: ["example-quarkus/**"]`.
4. **Skills de subpasta.** São descobertas sob demanda, com o aviso "New skills discovered in `<pasta>/.claude/skills`". O nome aparece sem prefixo de caminho, por isso nomes iguais em escopos diferentes seriam ambíguos.
5. **Agentes de `<pasta>/.claude/agents`.** Não foram descobertos em nenhum momento.

## Decisão

1. **Escopos.** Cada escopo tem um `AGENTS.md`, a fonte única do contexto dele, e um `CLAUDE.md` irmão com só `@AGENTS.md`. Os escopos são:
   - a raiz, só com o que vale para todo o repositório e o índice dos escopos;
   - o grupo `apps/services`, com o que vale para todo serviço;
   - os projetos `apps/backoffice`, `apps/backoffice-e2e`, `example-ts`, `example-go`, `example-quarkus` (o `core/` herda dele), `tools/serverless` e `infra/local`.

   `infra/terraform` entrou depois, com o Terraform local ([ADR 0011](./0011-estrutura-profissional-do-terraform.md)).
2. **Assets.** Rules e skills de um escopo ficam em `<escopo>/.agents/{rules,skills}`. O Claude Code os lê por symlinks relativos: `<escopo>/.claude/rules -> ../.agents/rules` e um `<escopo>/.claude/skills/<nome> -> ../../.agents/skills/<nome>` por skill.
   - As skills de Go, DDD, erros e NestJS foram para `apps/services`.
   - As de React foram para `apps/backoffice`.
   - Na raiz ficaram as de arquitetura e de código, e as do Nx, que são geradas.
3. **Agentes só na raiz** (resultado 5). Agente de projeto, quando existir, fica em `.agents/agents/`, com prefixo do projeto, e lê as skills do projeto pelo caminho.
4. **Rules divididas por stack**, com `paths:` locais ao escopo. Na raiz fica só o transversal. Em `apps/services` ficam:
   - `services-go`, com estilo, erros, testes, performance e tamanho em Go;
   - `services-typescript`;
   - `services-errors`.

   No backoffice fica a `nextjs-16`. A `code-patterns` foi redistribuída e saiu.
5. **Anticolisão (obrigatória).**
   - Cada instrução vive num único lugar, o escopo mais específico que a cobre. Ela é movida, não copiada. Um projeto não repete o que está na raiz, e o `AGENTS.md` da raiz não repete as rules.
   - Nomes de skill seguem `skill-<domínio>-<tema>`. Nomes de skill e de agente são únicos em todos os escopos e diferentes dos do usuário e dos plugins.
   - Nenhum tema existe em duas rules com globs que se sobreponham.
   - Rule sem `paths:` só na raiz.
6. **Fitness function.** O `tools/ai/check-instructions.mjs` (Node, sem dependência) roda no `pnpm lint` e no CI. Ele confere:
   - nomes únicos e sem colisão com os do usuário e dos plugins;
   - `name` igual à pasta;
   - symlinks relativos e válidos;
   - `CLAUDE.md` irmão com `@AGENTS.md`;
   - tamanho: 200 linhas para `AGENTS.md`, `CLAUDE.md` e rule, 500 para `SKILL.md` e 40 mil caracteres para todos;
   - frontmatter válido, só com `paths` nas rules;
   - rule sem `paths:` só na raiz;
   - agente fora da raiz;
   - links relativos quebrados.
7. **Biome.** O Biome ignora `.agents/` e `.claude/` em qualquer nível, porque o formatador de Markdown estraga o frontmatter.
8. **Backoffice.**
   - A rule `nextjs-16` lista o que o modelo escreve errado no Next 16.4. Cada item foi conferido contra `node_modules/next/dist/docs/`.
   - O MCP `next-devtools` fica fixado em `next-devtools-mcp@0.4.0`, no `.mcp.json`.
   - O bloco gerenciado do `next dev` continua no `AGENTS.md`. O conteúdo do projeto fica fora dos marcadores, porque o `generate-agent-files.js` só substitui o trecho entre eles.

Alternativas descartadas:

- **Tudo na raiz, só com `paths:`.** As skills continuariam na lista de toda sessão, e as stacks, misturadas.
- **Agentes em `<projeto>/.claude/agents`.** Não são descobertos (resultado 5).
- **Copiar o comum para cada projeto.** Duplica e diverge com o tempo.
- **`@next/codemod agents-md` e as skills `next-best-practices` e `next-upgrade`.** São legados ou aposentados.
- **`vercel-react-best-practices` (`vercel-labs/agent-skills`, MIT).** Avaliada e não instalada por três motivos:
  - Tem 70 regras genéricas de performance que disparam na mesma intenção da `skill-react-best-practices`, e isso criaria duas skills concorrentes no painel.
  - Recomenda libs que o repositório não usa (SWR, `better-all`, cache LRU).
  - Está em inglês.

  Se houver ganho, extraia para a skill local as poucas regras de maior impacto que faltam (por exemplo `server-serialization`, `server-dedup-props` e `bundle-defer-third-party`), citando a fonte.

## Consequências

- **Ganhos**:
  - A sessão começa menor: a raiz tem só o geral, e as rules e skills de uma stack carregam quando um arquivo dela é lido.
  - Cada instrução tem um dono.
  - O script barra colisão, symlink quebrado e arquivo grande demais antes do merge.
  - Codex, Cursor e Copilot leem o mesmo `AGENTS.md` aninhado.
- **Custos e riscos**:
  - Uma skill de projeto só aparece depois que o agente lê um arquivo do projeto.
  - Um subagente da raiz que precise dela deve ler o `SKILL.md` pelo caminho.
  - Há mais arquivos e symlinks, e o Windows precisa de `core.symlinks=true`.
  - O `AGENTS.md` da raiz ficou no limite de 200 linhas (o bloco gerenciado do Nx conta), então conteúdo novo precisa ir para o escopo certo.
  - O teste prático depende do comportamento atual do Claude Code e pode mudar.
- **Gatilho de revisão**:
  - O Claude Code passar a descobrir agentes em subpasta, ou mudar a carga sob demanda.
  - A entrada de escopos novos de infraestrutura além de `infra/terraform`.
