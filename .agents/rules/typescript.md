---
paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.mts"
  - "**/*.cts"
---

# TypeScript

Vale para todo projeto TypeScript. TypeScript estrito, Biome e comentário do porquê estão no `AGENTS.md` da raiz; o que é só de um projeto está no `AGENTS.md` ou nas rules dele. Exemplos e decisões de estilo: skill `skill-code-standards`; camadas e portas: `skill-architecture-patterns`.

## Imports nos projetos `nodenext`

Os serviços TypeScript e o `tools/serverless` seguem o `moduleResolution: nodenext` do `tsconfig.base.json`:

- import relativo **com** `.js` (`'./hello.js'`);
- import de tipo com `import type` (`verbatimModuleSyntax`).

O `apps/backoffice` usa `bundler`, e as regras de import dele estão no `AGENTS.md` do projeto.

## Estilo

- Export **nomeado**; `default` só onde o framework exige (arquivos especiais do Next).
- Sem `var`, sem `any` (use `unknown` e estreite).
- Duas ou mais entradas na função: um objeto de parâmetros nomeados.
- Tipo de parâmetro e de retorno sempre **com nome**: `interface` (ou `type`) declarada acima da função, com campos `readonly`. Nenhum tipo de objeto escrito dentro da assinatura, nem nas props de um componente.
- Nomes de arquivo e identificadores em inglês, `kebab-case` nos arquivos (`confirm-modal.tsx`); texto de interface, descrição de teste e comentário em PT-BR.
- Valores repetidos 3 vezes ou mais viram constante nomeada, perto de quem usa.

## Legibilidade

Aplicação em TypeScript do "código chato acima de código esperto" (skill `skill-clean-code`): quem lê entende o algoritmo na primeira leitura, sem decifrar a expressão.

- Um passo por linha, com valor intermediário nomeado; laço explícito e retorno antecipado no lugar de expressão aninhada.
- Sem ternário aninhado, sem `reduce` e sem cadeia longa de `map`, `filter` e `flatMap` para encurtar; callback de coleção não altera variável de fora.
- Problema igual, solução igual: use o helper ou o padrão que o módulo já tem, em vez de uma variação nova.
- A versão densa só fica quando traz ganho de desempenho **medido**, com um `WHY:` dizendo qual.
