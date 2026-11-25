# ADR 0016: React Flow no editor de processos

- **Status**: Aceito
- **Data**: 2026-11-23

## Contexto

O backoffice ganha um editor visual de processos (`/processos`): blocos (Início, Etapa, Decisão, Convergência, Fim e Anotação) ligados por conexões direcionais num canvas com zoom, navegação, seleção, desfazer e refazer. Construir do zero o canvas, o arraste com zoom, o desenho das conexões e o uso por teclado é muito código, e muitos defeitos de interação que bibliotecas maduras já resolveram. O CoreUI Free ([ADR 0003](./0003-coreui-free-no-backoffice-nextjs.md)) não tem componente de diagrama.

## Decisão

- Usar o **React Flow** (`@xyflow/react`, licença MIT) na versão **13.0.2**, pelo catálogo do pnpm, só no editor de processos (`apps/backoffice/src/app/(painel)/processos`).
- As regras do processo (o que pode conectar, validação, histórico, ramos e duplicação) ficam em funções puras em `processos/model`, sem importar o React Flow. A biblioteca desenha e emite eventos; trocar a camada visual não reescreve as regras.
- Desfazer e refazer são nossos, por instantâneos do grafo, porque o React Flow não traz o recurso pronto (o exemplo oficial é do plano pago).
- O selo "React Flow" fica visível no canvas. A licença MIT permite tirá-lo, mas a documentação do React Flow associa a remoção à assinatura do plano Pro.
- As cores do canvas vêm das variáveis de tema do React Flow (`--xy-*`) presas às do CoreUI, em `src/scss/_custom.scss`. A versão 13 tirou a prop `colorMode` e usa `light-dark()`, que o pipeline de CSS do Next converte para seguir a preferência do sistema, e não o tema escolhido no painel.
- Alternativa descartada: implementação própria com SVG e Pointer Events, sem dependência nova, pelo custo de código e de testes de interação.

## Consequências

- **Ganhos**: canvas, zoom, minimapa, arraste, pontos de conexão, reconexão e navegação por teclado prontos, com os textos de acessibilidade traduzidos para PT-BR (`ariaLabelConfig`).
- **Custos**: 20 pacotes transitivos (entre eles `zustand` e `d3`), carregados só na rota `/processos`. Os testes no jsdom precisam dos mocks do guia de testes do React Flow (`processos/react-flow-test-setup.ts`); arraste e conexão reais ficam no e2e.
- **Atenção**: a 13.0.0 saiu em 16/11/2026 e mudou APIs da 12: o `onNodesChange` recebe um `NodeChangeset`, o `useStore` foi dividido e a prop `colorMode` saiu. A maior parte da documentação e dos exemplos ainda descreve a 12, então o código segue os tipos instalados. Se aparecer defeito bloqueante, a saída é fixar a 12.12.1 e registrar a mudança num ADR novo.
- **Gatilho de revisão**: defeito bloqueante na 13, necessidade de recurso exclusivo do plano Pro, ou um segundo editor visual no painel, o que pede promover o editor para `src/shared`.
