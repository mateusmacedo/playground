---
name: skill-clean-code
description: >-
  Código limpo no playground, só o que não é óbvio: nomes, funções pequenas, early return, `unknown` em vez de `any`, comentário apenas do porquê com os marcadores `WHY:` e `NOTE:`, code smells e refatoração segura, em TypeScript (`apps/services`, `apps/backoffice`, `tools/serverless`) e Go. Use ao refatorar, revisar legibilidade, escolher nomes ou decidir se um comentário deve existir. NÃO usar para as convenções de ferramenta e estrutura do repositório (use skill-code-standards) nem para estrutura de camadas (use skill-architecture-patterns).
---

# Clean code

Princípios gerais (SOLID completo, "funções de até N linhas") qualquer modelo já conhece e não estão aqui. Esta skill guarda o que decide a qualidade **neste repositório**. Formatação e lint são do Biome (`pnpm format`): não discuta estilo que a ferramenta resolve.

**Obrigatório:** código chato acima de código esperto (legível antes de curto), como define a seção 1 da rule global `~/.claude/rules/senior-engineering.md` do mantenedor. Esta skill detalha a aplicação aqui.

## Quando usar

- Refatorar ou revisar a legibilidade de um trecho.
- Escolher o nome de uma função, tipo ou variável.
- Decidir se um comentário deve existir e como escrevê-lo.

## Nomes

- **Identificadores em inglês**; texto exibido ao usuário e mensagens de erro para quem consome a API em PT-BR (`AGENTS.md`). Comentários e descrições de teste seguem o idioma do código existente, que é PT-BR.
- O nome diz a **intenção**, não o tipo: `activeUsers`, não `arr`. Função é verbo (`validateInput`, `sayHello`); tipo e valor são substantivos.
- Booleano com prefixo `is`, `has`, `can` ou `should`: `isLoading`, `canEdit`.
- Arquivos em kebab-case (`app-sidebar-nav.tsx`, `resolve-serverless-targets.ts`); testes `*.spec.ts` ao lado do código.
- Se precisa de um comentário para explicar o nome, renomeie.
- Número ou texto mágico vira constante com nome: `maxMessageBytes = 256 * 1024` (o limite de mensagem do SQS), `defaultPort`.

Go, onde difere:

- Getter sem `Get`: `User.Name()`, não `GetName()`.
- Acrônimos em maiúsculas: `UserID`, `HTTPClient`.
- Receiver de 1 a 2 letras do tipo (`u *User`); nome curto em escopo curto, descritivo em escopo longo.
- O pacote já dá contexto: `core.SayHello`, não `core.CoreSayHello`.

## Funções

- **Uma coisa, um nível de abstração.** Se o corpo mistura validar, calcular e escrever, são três funções. O entrypoint do `example-ts` é o modelo: traduz o evento, chama o núcleo, devolve a resposta.
- **Guard clauses** em vez de aninhar:

```ts
// Aninhado
const handleOrder = (order: Order | undefined) => {
  if (order) {
    if (order.items.length > 0) {
      // regra
    }
  }
};

// Plano
const handleOrder = (order: Order | undefined) => {
  if (!order) return;
  if (order.items.length === 0) return;
  // regra
};
```

- **Vários parâmetros, ou parâmetros do mesmo tipo em sequência, viram um objeto** com tipo nomeado, como o `HelloRequest` do `example-ts`. Em Go, uma `struct` de entrada.
- **Sem parâmetro booleano que muda o comportamento**: `render(true)` não diz nada. Separe em duas funções ou use uma união de literais.
- **Entrada imutável**: parâmetros e retorno `readonly` quando o dado não deve mudar (o backoffice faz isso em `Session` e `Crumb`).
- Função pura sempre que der; efeito colateral fica na borda (entrypoint e adapters).

## Tipos

- `any` não entra (`AGENTS.md`). Dado de fora (corpo JSON, evento, `catch`) é `unknown` e se estreita:

```ts
try {
  await handle(body);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  log('error', 'handle_failed', { message });
}
```

- `as` só na fronteira, onde o tipo vem de fora e a garantia é de outra camada (um evento montado em teste, por exemplo). No meio do código é sinal de tipo mal modelado.
- Prefira união de literais (`'draft' | 'placed'`) a `string` solto quando o conjunto é fechado.

## Comentários: só o porquê

O código diz **o quê**; o comentário diz **por quê**. Use os marcadores do repositório:

| Marcador | Uso | Exemplo real |
| -------- | --- | ------------ |
| `WHY:` | Razão de uma decisão que não é óbvia | `// WHY: devolver só os ids que falharam permite reprocessar apenas essas mensagens, sem repetir o lote inteiro.` |
| `NOTE:` | Fato que quem lê precisa saber | `// NOTE: em container, um consumidor de produção faz long polling da fila (ReceiveMessage)...` |

Escreva comentário quando houver: uma restrição externa (limite de serviço, bug de versão), uma decisão contraintuitiva, uma invariante que o tipo não expressa, ou um risco. Não escreva:

- O que o código já diz (`// incrementa o contador`).
- Histórico (`// antes era X`): o git guarda.
- Código comentado: apague.
- Banners e separadores (`// ======`).
- Narração de passos (`// Primeiro, ... depois, ...`).

Contratos públicos do painel levam JSDoc em PT-BR (`/** Um passo do breadcrumb... */`). Rationale longo ou que cruza arquivos vai para um ADR em `docs/adr/`, com um `WHY:` curto apontando para ele.

## Code smells

| Smell | Tendência de solução |
| ----- | -------------------- |
| Função longa ou com `if` aninhado | Extrair função, guard clauses |
| `process.env` lido em vários pontos | Ler uma vez no entrypoint e passar a configuração |
| Estado em escopo de módulo que muda a resposta | Cache de reuso é aceitável; fonte de verdade não (o serviço é stateless) |
| Regra de negócio no handler, no router ou no componente | Mover para o núcleo ou para uma função pura |
| `catch` vazio, erro ignorado | Tratar, relançar ou registrar |
| Código duplicado 3 vezes | Extrair; duas vezes ainda pode ser coincidência |
| Abstração para um único uso (fábrica, builder, interface) | Remover até existir o segundo uso |
| Dependência circular entre módulos | O Biome (`noImportCycles`) e o compilador Go apontam; redesenhe a fronteira |

## Go: idiomas que não são óbvios

- **Aceite interfaces, devolva structs**; a interface é declarada no pacote que a **consome**, pequena.
- **Early return** em cada erro, sem `else` depois de `return`.
- **Zero value útil**: tipos que funcionam sem construtor quando possível.
- `context.Context` é o primeiro parâmetro de função que faz I/O.
- Duplicar 5 linhas costuma ser melhor que importar uma dependência.

## Refatoração segura

1. Tenha teste do comportamento atual **antes** de mexer. Sem teste, escreva um que fixe o comportamento.
2. Passos pequenos, cada um verde: renomear, extrair, mover.
3. Antes de renomear ou mover um símbolo, **busque todas as referências**: imports, mocks de teste, imports dinâmicos, re-exports e configs (`AGENTS.md`, "Segurança de alterações").
4. Não altere um teste só para fazê-lo passar. Se o teste estiver errado, explique por quê antes.
5. Mudança de comportamento e refatoração não andam no mesmo passo.
6. Valide: `pnpm nx affected -t lint typecheck test` e `pnpm format:check`. Remoção de mais de 30 linhas de código pede confirmação.
7. Melhorias vistas pelo caminho são **reportadas**, não incluídas na entrega.

## Checklist

- [ ] Nomes revelam a intenção; identificadores em inglês.
- [ ] Funções fazem uma coisa; sem aninhamento profundo nem parâmetro booleano ambíguo.
- [ ] Sem `any`; dado externo entra como `unknown`.
- [ ] Todo comentário explica o porquê, com `WHY:` ou `NOTE:`; nenhum código comentado.
- [ ] Sem abstração sem segundo uso; sem regra de negócio na borda.
- [ ] Referências buscadas antes de renomear ou mover; testes e lint verdes.

## Veja também

- `AGENTS.md` ("Código" e "Segurança de alterações").
- `docs/adr/0007-lint-e-formatacao-biome-eslint-minimo.md` (o que o Biome resolve por você).
- Skills `skill-code-standards` e `skill-architecture-patterns`.
