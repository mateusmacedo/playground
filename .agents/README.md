# `.agents/`: instruções de IA por escopo

As instruções de IA deste monorepo são organizadas por **escopo** ([ADR 0012](../docs/adr/0012-instrucoes-de-ia-por-projeto.md)). Este `.agents/` guarda os assets **transversais** da raiz; cada projeto ou grupo tem o seu `.agents/` com o que é só dele. O índice dos escopos está na seção "Instruções de IA" do [`AGENTS.md`](../AGENTS.md) da raiz.

## Estrutura de um escopo

```text
<escopo>/AGENTS.md                      contexto do escopo (fonte única)
<escopo>/CLAUDE.md                      só: @AGENTS.md
<escopo>/.agents/rules/*.md             rules com paths: relativos ao escopo
<escopo>/.agents/skills/skill-<nome>/   skills do escopo
<escopo>/.claude/rules  -> ../.agents/rules
<escopo>/.claude/skills/skill-<nome> -> ../../.agents/skills/skill-<nome>   (um por skill)
```

Só a raiz tem `.agents/agents/` (e o symlink `.claude/agents -> ../.agents/agents`): o Claude Code não descobre agentes em subpasta. Um escopo sem rules ou skills tem só o `AGENTS.md` e o `CLAUDE.md`.

## Como o Claude Code carrega

| O quê                                        | Quando carrega                                                                 |
| -------------------------------------------- | ------------------------------------------------------------------------------ |
| `CLAUDE.md` e `AGENTS.md` da raiz             | Em toda sessão                                                                 |
| `CLAUDE.md` de um escopo (e o `AGENTS.md` importado) | Quando o agente lê um arquivo da pasta, inclusive os de escopos intermediários |
| Rule                                         | Quando o arquivo lido casa com o `paths:`, relativo à pasta que contém o `.claude` |
| Skill de escopo                              | Entra na lista quando o agente lê um arquivo da pasta; o nome aparece sem prefixo |
| Agente                                       | Só os da raiz                                                                  |

O `CLAUDE.md` existe porque, quando ele está presente, o Claude Code ignora o `AGENTS.md`. Codex, Cursor e Copilot leem o `AGENTS.md` direto.

## Assets da raiz

| Rule                  | Cobre                                                                    |
| --------------------- | ------------------------------------------------------------------------ |
| `ci-quality`          | Ferramentas e onde cada verificação roda                                 |
| `error-handling`      | O que vale para todo erro: não vazar detalhe, sem `catch` vazio, logar uma vez |
| `file-organization`   | Colocalização, sem barrel, dependência para dentro                       |
| `file-size-limits`    | Tamanho de arquivo e função em TypeScript                                |
| `performance`         | Medir antes; dados e chamadas externas                                   |
| `process-enforcement` | Antes de escrever, mudança que cruza fronteira, validação conforme o que mudou |
| `security`            | Segredos, autorização, entrada e saída, IAM, CI                          |
| `testing-conventions` | O que vale para todo teste                                               |
| `typescript`          | Imports `nodenext` e estilo de TypeScript                                |

- Agentes (somente leitura, `tools: Read, Grep, Glob, Bash`): `architecture`, `change-impact-analysis` e `security`. Revisão geral, depuração, testes e performance **não** têm agente local: usam os do plugin global, que uma cópia local sombrearia.
- Skills: `skill-architecture-patterns`, `skill-evolutionary-architecture`, `skill-clean-code` e `skill-code-standards`.
- As skills do Nx (`nx-*`, `monitor-ci`, `link-workspace-packages`) são geradas pelo `nx configure-ai-agents` e **não** devem ser editadas à mão. Não têm symlink em `.claude/skills/`: chegam pelo plugin `nx@nx-claude-plugins` do `.claude/settings.json`, e um symlink as duplicaria.

## Assets dos escopos

| Escopo           | Rules                                                     | Skills                                                                                                                                                        |
| ---------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/backoffice` | `nextjs-16`                                              | `skill-react-best-practices`, `skill-react-component-structure`                                                                                               |
| `apps/services`  | `services-go`, `services-typescript`, `services-errors`   | `skill-go`, `skill-go-http-patterns`, `skill-go-db-patterns`, `skill-go-queue-patterns`, `skill-go-testing`, `skill-ddd`, `skill-error-handling`, `skill-nestjs-patterns` |

Os demais escopos (`apps/backoffice-e2e`, `example-ts`, `example-go`, `example-quarkus`, `tools/serverless`, `infra/local`) têm só `AGENTS.md` e `CLAUDE.md`.

## Regras de anticolisão

- Cada instrução vive num único lugar: o escopo mais específico que a cobre. Mova, não copie. O projeto não repete a raiz, e o `AGENTS.md` não repete as rules do mesmo escopo.
- Nenhum tema em duas rules cujos globs se sobreponham. Rule sem `paths:` só na raiz.
- Nomes de skill `skill-<domínio>-<tema>`; nomes de skill e de agente únicos em todos os escopos e diferentes dos do usuário (`~/.claude/skills`, `~/.claude/agents`) e dos plugins.
- `AGENTS.md`, `CLAUDE.md` e rule com até 200 linhas; `SKILL.md` com até 500; todos com até 40 mil caracteres.

`node tools/ai/check-instructions.mjs` confere tudo isso (e symlinks, frontmatter e links relativos). Roda no `pnpm lint` e no CI.

## Mudar ou acrescentar

- **Rule**: crie `<escopo>/.agents/rules/<nome>.md` com `paths:` relativos ao escopo (é a única chave lida). Se o escopo ainda não tem rules, crie o symlink `ln -s ../.agents/rules <escopo>/.claude/rules`.
- **Skill**: crie `<escopo>/.agents/skills/skill-<nome>/SKILL.md` (frontmatter só com `name` igual à pasta e `description` que diga o que cobre e quando usar) e o symlink `ln -s ../../.agents/skills/skill-<nome> <escopo>/.claude/skills/skill-<nome>`.
- **Agente**: só na raiz, em `.agents/agents/`, com o prefixo do projeto ou do domínio quando for específico.
- **Escopo novo**: `AGENTS.md` com o que é só dele, `CLAUDE.md` com `@AGENTS.md` e a linha no índice do `AGENTS.md` da raiz.
- **Roadmap**: o que ainda não existe (NestJS, Terraform, `main-http` em TS) está rotulado como padrão a seguir. Ao implementar, atualize a rule ou a skill correspondente.
- `.agents/` e `.claude/` ficam fora do Biome em qualquer nível, porque o formatador de Markdown estraga o frontmatter.
- Em Windows, o Git precisa de `core.symlinks=true` para materializar os symlinks.
