# ADR 0017: Diagrama da execução em `/processos/execucao`

- **Status**: Aceito
- **Data**: 2026-11-26

## Contexto

Um card do quadro (`/quadro`) pode seguir um processo desenhado no editor (`/processos`), e quem acompanha o card precisa ver o diagrama com a etapa atual destacada. O diagrama reaproveita os blocos e as conexões do editor, que são do React Flow.

Duas regras já valiam:

- O React Flow é restrito ao editor de processos ([ADR 0016](./0016-react-flow-no-editor-de-processos.md)): os 20 pacotes transitivos dele só carregam na rota `/processos`.
- `quadro` e `processos` não se importam, em nenhum sentido. Os dois dependem só de `src/shared/process`, que guarda o roteiro, a execução, o motor e o catálogo, sem React Flow.

Mostrar o diagrama dentro do painel do card quebraria as duas: o quadro passaria a importar o editor e a carregar o React Flow, mesmo com carregamento dinâmico.

## Decisão

- O diagrama da execução fica na página **`/processos/execucao?ref=<id do quadro>:<id do card>`**, dentro da rota do editor e fora do quadro. O viewer somente leitura (`processos/viewer`) usa o React Flow e os blocos do editor, e marca cada bloco pelo id: os ids das etapas do roteiro são os ids dos blocos do desenho.
- O card tem um link "Ver diagrama", e não um diagrama embutido. A página traz o nome do processo e a versão, o card, a hora da situação e o link de volta ao card.
- **A ligação entre os dois lados é a porta `RunViewStore`** (`src/shared/process/run-view-store.ts`). O quadro grava a situação da execução (`RunView`: a referência, o processo e a versão, os nomes que a página mostra, o endereço de volta e a execução) e navega; a página lê a situação e calcula os estados das etapas com o roteiro da versão no catálogo. O adaptador do navegador guarda as 20 situações mais recentes no `localStorage`, e só aceita endereço de volta interno ao painel.
- **Com a API ligada** ([ADR 0018](./0018-contrato-openapi-e-mock-da-api-do-backoffice.md)), a página monta a mesma vista lendo o quadro e a definição do processo pela API, a partir do `ref`; a porta continua como a situação guardada neste navegador. Como a página lê o quadro do servidor, o link "Ver diagrama" espera a gravação pendente do quadro terminar antes de abrir, e não abre quando ela falha ou entra em conflito.
- A página lê o `ref` no navegador, como o quadro lê o card do endereço, e por isso a rota continua estática.
- Sem `ref`, que é como o item "Execuções" do menu a abre, a mesma rota lista as execuções em andamento de todos os quadros, e cada linha leva ao diagrama da execução. A lista lê os quadros pela porta `BoardRunsSource` (`src/shared/process/board-runs-source.ts`), com um adaptador do navegador e um da API, e não importa o quadro: as chaves do `localStorage` que os dois usam ficam em `src/shared/board`.
- Alternativas descartadas:
  - diagrama no painel do card, com `next/dynamic`: leva o React Flow e o código do editor para a rota do quadro;
  - desenho próprio no quadro, em SVG, sem o React Flow: duplica o desenho dos blocos e deixa o diagrama diferente do editor;
  - promover os blocos do editor para `src/shared`: é o gatilho de revisão do ADR 0016, e um viewer que mora em `/processos` não precisa disso.

## Consequências

- **Ganhos**: a rota do quadro continua sem o React Flow; editor e execução têm um desenho só; o quadro e o editor seguem independentes, ligados por um contrato pequeno e testável.
- **Custos e riscos**: ver o diagrama tira o usuário do quadro, e a volta depende do link da página. A vista é a situação de um momento, não acompanha o card ao vivo; com a API, ela é relida quando a pessoa volta para a aba. Sem a API, a situação e o catálogo existem só no navegador em que foram gravados, e a página explica quando não os encontra.
- **Gatilho de revisão**: necessidade de diagrama ao vivo dentro do card, ou um segundo lugar fora de `/processos` que precise do viewer.
