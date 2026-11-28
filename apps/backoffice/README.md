# Backoffice

[![Quality gate](https://sonarcloud.io/api/project_badges/measure?project=mateusmacedo_playground&metric=alert_status)](https://sonarcloud.io/summary/overall?id=mateusmacedo_playground) [Métricas desta pasta no SonarQube Cloud](https://sonarcloud.io/code?id=mateusmacedo_playground&selected=mateusmacedo_playground%3Aapps%2Fbackoffice)

Painel administrativo em **Next.js 16** (App Router) e **React 19**, com o shell do **CoreUI Free 5.x**: menu lateral filtrado por permissão, cabeçalho com tema claro, escuro e automático, breadcrumb e rodapé com o ambiente. As decisões por trás estão nos ADRs [0003](../../docs/adr/0003-coreui-free-no-backoffice-nextjs.md) e [0006](../../docs/adr/0006-next-16-4-6-e-allowed-dev-origins.md).

Projeto Nx `backoffice`, com tags `scope:backoffice` e `type:app`. Os testes de ponta a ponta ficam em [`apps/backoffice-e2e`](../backoffice-e2e).

## O que o painel faz

| Rota                  | Item do menu          | O que é                                                                                          |
| --------------------- | --------------------- | ------------------------------------------------------------------------------------------------ |
| `/`                   | Início                | Página inicial.                                                                                  |
| `/quadro`             | Quadro                | Quadro de tarefas: cada tarefa é um card, que pode ter cards filhos e seguir um processo.        |
| `/processos`          | Processos › Editor    | Editor visual e catálogo de processos.                                                           |
| `/processos/execucao` | Processos › Execuções | Lista dos processos em andamento nos cards; com `?ref=` no endereço, o diagrama de uma execução. |
| `/sem-acesso`         | fora do menu          | Destino de quem não tem nenhuma permissão.                                                       |

"Quadro" e "Processos" levam o selo "Beta" no menu. O processo é desenhado e publicado em `/processos` e executado nos cards de `/quadro`. As seções [Quadro](#quadro), [Processos](#processos) e [Onde os dados ficam](#onde-os-dados-ficam) detalham cada parte.

## Comandos

Todos pela raiz do repositório, via Nx:

```bash
pnpm nx dev backoffice          # servidor de desenvolvimento em http://localhost:3000
pnpm nx build backoffice        # next build (gera o artefato standalone)
pnpm nx start backoffice        # next start, depois do build
pnpm nx lint backoffice         # fronteiras do Nx (ESLint mínimo)
pnpm format:check                # Biome: formatação e lint do código
pnpm nx test backoffice         # Vitest com jsdom
pnpm nx e2e backoffice-e2e                # Playwright (Chromium por padrão)
```

## Variáveis de ambiente

Copie `.env.example` para `.env.local` e ajuste. O arquivo `.env` é ignorado pelo git.

| Variável               | Padrão       | Descrição                                                                                                                  |
| ---------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_NAME` | `Backoffice` | Nome do painel: título da aba, marca do menu e rodapé.                                                                     |
| `NEXT_PUBLIC_STAGE`    | `local`      | Ambiente exibido no rodapé: `local`, `dev`, `homolog` ou `prod`. Outro valor falha o build.                                |
| `NEXT_PUBLIC_API_URL`  | vazio        | Endereço base da API do painel, `http` ou `https`. Vazio, o painel guarda tudo no navegador. Valor inválido falha o build. |

Variáveis `NEXT_PUBLIC_*` **entram no bundle do navegador** no build. Nunca coloque segredo nelas. A leitura é feita em um único lugar, `src/core/config/app-config.ts`, que expõe `appConfig` (nome, ambiente, endereço da API e crédito do rodapé) e o enum `AppStage`.

### API do painel

Com `NEXT_PUBLIC_API_URL`, os quadros e as definições de processo são lidos e gravados pela API, um documento inteiro por vez, com conflito de revisão quando outra pessoa gravou antes. Sem a variável, o painel guarda tudo no `localStorage`. O que muda nas telas entre os dois modos está em [Onde os dados ficam](#onde-os-dados-ficam). O backend real ainda não existe: localmente a API é servida pelo mock de [`apps/backoffice-mock`](../backoffice-mock/README.md), em `http://127.0.0.1:4010`:

```bash
pnpm nx run backoffice-mock:up
```

O código da API fica em `src/shared/api`: o cliente HTTP (tempo limite, Problem Details, `ETag` e `If-Match`), os tipos do contrato e o `usePanelApi()`, que é por onde as telas pedem a API e que devolve `null` quando a variável não está definida. Os dois modos, os cenários de falha do mock e o uso no e2e estão no [guia da API do backoffice](../../docs/guides/backoffice-api.md); a decisão, no [ADR 0018](../../docs/adr/0018-contrato-openapi-e-mock-da-api-do-backoffice.md).

## Quadro

A rota `/quadro` é um quadro kanban. Há vários quadros, cada um com nome e prefixo próprio no código dos cards (`QD-12`). As colunas podem ser ocultas ou bloqueadas, e os cards arquivados ficam numa coluna própria. O card tem responsável, etiquetas, prazo, checklist, comentários, anexos e histórico. A barra do quadro tem busca, filtro por etiqueta, desfazer e refazer. O endereço guarda o quadro e o card abertos (`?quadro=<id>&card=QD-12`).

### Cards filhos e dependências

| Recurso             | Como funciona                                                                                                                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Card filho          | Um card pode ter um card pai, e o filho também pode ter filhos. Pai e filho podem estar em colunas diferentes.                                                                                                                 |
| Progresso           | O card pai mostra quantos descendentes estão na coluna de conclusão, e não só os filhos diretos: "2/5 filhos" ou, quando há netos, "2/5 descendentes". Sem coluna de conclusão no quadro, mostra só quantos filhos o card tem. |
| Item de checklist   | "Converter em card filho" tira o item do checklist e cria o card filho na coluna do pai.                                                                                                                                       |
| Duplicar com filhos | Copia o card com todos os descendentes. As cópias não levam processo, dependências nem histórico. O botão aparece no card que tem filhos.                                                                                      |
| Dependência         | A seção "Dependências" do card lista quem o bloqueia e quem ele bloqueia. O quadro recusa a dependência que fecharia um ciclo. O card leva o selo "Bloqueado" enquanto houver bloqueador fora da coluna de conclusão.          |

### Regras do quadro

Ficam em "Configurar quadro", todas desligadas até alguém ligar. As cinco primeiras dependem da coluna de conclusão e ficam travadas enquanto o quadro não tem uma.

| Regra                             | Efeito                                                                           |
| --------------------------------- | -------------------------------------------------------------------------------- |
| Card pai espera os filhos         | O card pai só entra na coluna de conclusão depois de todos os filhos.            |
| Card pai acompanha os filhos      | Quando o último filho chega à coluna de conclusão, o card pai vai junto.         |
| Conclusão espera o processo       | O card com processo em andamento não entra na coluna de conclusão.               |
| Processo concluído conclui o card | Quando o processo termina, o card vai para a coluna de conclusão.                |
| Conclusão espera as dependências  | O card bloqueado por outro ainda não concluído não entra na coluna de conclusão. |
| Card filho herda do pai           | O card filho novo recebe o responsável e as etiquetas do card pai.               |

### Visões

| Visão  | O que mostra                                                                                                                                                                                        |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Quadro | As colunas com os cards. "Linhas por card pai" agrupa os cards em linhas, uma por card pai.                                                                                                         |
| Lista  | Um card por linha, com código, título, coluna, responsável, prazo, progresso, processo e etiquetas. "Lista em árvore" põe cada card abaixo do pai, com recuo por nível, e deixa recolher os filhos. |
| Etapas | As etapas pendentes dos processos em andamento nos cards, da que vence primeiro para as sem prazo, com filtro por papel e a atrasada em destaque.                                                   |

O filtro "Filtrar por hierarquia" (só cards pai, só filhos ou só de topo) soma-se à busca e às etiquetas. A visão escolhida, a árvore e as linhas recolhidas ficam guardadas no navegador, por quadro.

### Processo no card

A seção "Processo" do card liga o card a um processo publicado em `/processos`.

| Passo               | O que a tela faz                                                                                                                                                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Iniciar             | "Escolher processo" lista os processos publicados, cada um na última versão, e "Iniciar processo" começa a execução.                                                                                                                  |
| Etapas              | Cada etapa ativa aparece com o tipo, o papel, as instruções, o prazo e a ação do tipo dela: concluir, seguir por um caminho, aprovar ou rejeitar, registrar o evento ou uma exceção. A etapa parada numa junção só espera.            |
| Campos              | A etapa pede os campos que o processo definiu para ela. Campo obrigatório vazio recusa a conclusão, e a rejeição de uma aprovação exige a observação.                                                                                 |
| Card filho de etapa | "Criar card filho para esta etapa" cria um card filho com o nome da etapa. Quando ele chega à coluna de conclusão, a etapa é concluída; a etapa que pede campo obrigatório ou uma escolha continua aberta, e é resolvida no card pai. |
| Trilha              | "Trilha da execução" guarda cada passo, com quem o fez, a observação e os valores dos campos.                                                                                                                                         |
| Diagrama            | "Ver diagrama" abre `/processos/execucao?ref=<id do quadro>:<id do card>`, com a etapa atual marcada no desenho.                                                                                                                      |

O processo em andamento pode ser cancelado. O encerrado pode ser removido do card ou dar lugar a outro. O card mostra o selo do processo, com as etapas feitas e o total, e avisa quando há etapa atrasada.

A execução fica **congelada na versão** em que começou: o quadro guarda o roteiro daquela versão. Publicar uma versão nova não muda o card, que só avisa que ela existe.

## Processos

A rota `/processos` é o editor visual de processos, feito com o React Flow ([ADR 0016](../../docs/adr/0016-react-flow-no-editor-de-processos.md)): blocos arrastados da biblioteca para o canvas e ligados por conexões. O bloco "Aprovação" tem uma saída para aprovar e outra para rejeitar. Os blocos "Etapa", "Tarefa humana" e "Aprovação" aceitam campos a preencher (texto curto, texto longo, número, data, lista de opções e caixa de marcação), que podem ser obrigatórios.

### Catálogo

O editor trabalha sobre um catálogo com vários processos. O seletor "Processo" troca o processo aberto e mostra a situação dele: "Rascunho", "Publicada vN" ou "Publicada vN, com alterações não publicadas".

| Parte              | Como funciona                                                                                                                                                                                                  |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rascunho           | O desenho em edição, um por processo. É gravado por "Salvar rascunho", completo ou incompleto.                                                                                                                 |
| Versões publicadas | "Publicar versão" confere os erros do desenho, compila-o no roteiro que o quadro executa e grava a versão seguinte. A versão publicada não muda. "Versões" lista as publicadas e abre uma delas como rascunho. |
| Arquivamento       | "Arquivar processo" tira o processo do seletor e dos processos que o quadro oferece. As versões continuam guardadas, e "Arquivados" o restaura. Não há exclusão.                                               |

"Novo processo" e "Ações do processo" criam, renomeiam, descrevem e duplicam um processo.

### Execuções

A rota `/processos/execucao` tem duas telas, conforme o endereço:

| Endereço                           | Tela                                                                                                                                                                                                            |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sem `ref`, como o menu a abre      | A lista das execuções em andamento de todos os quadros: processo e versão, card, quadro, etapa atual, progresso, início e o link "Ver diagrama". As atrasadas vêm primeiro; depois, as iniciadas há mais tempo. |
| `?ref=<id do quadro>:<id do card>` | O diagrama daquela execução, somente leitura, com cada bloco marcado como etapa atual, em espera, concluída ou com exceção acionada, e os links "Voltar ao card" e "Todas as execuções".                        |

O diagrama mora na rota do editor, e não no card, para o quadro não carregar o React Flow ([ADR 0017](../../docs/adr/0017-diagrama-da-execucao-em-processos-execucao.md)).

## Onde os dados ficam

Os quadros e os processos ficam em um de dois lugares, conforme `NEXT_PUBLIC_API_URL`. As telas são as mesmas nos dois modos.

| Modo      | Quando         | Onde ficam os quadros e os processos                             |
| --------- | -------------- | ---------------------------------------------------------------- |
| Navegador | Sem a variável | No `localStorage`                                                |
| API       | Com a variável | Na API do painel, um documento inteiro por quadro e por processo |

O [guia da API do backoffice](../../docs/guides/backoffice-api.md) compara os dois modos (gravação, mudança feita em outro lugar, releitura ao voltar para a aba) e mostra como ligar a API, subir o mock e simular falhas.

### Estados de tela com a API

| Situação          | Quadro                                                                                                                          | Editor de processos                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Carregando        | "Carregando os quadros…" e, em cada quadro, "Carregando o quadro…"                                                              | "Carregando o editor…"                                                                             |
| Erro de leitura   | "Não foi possível carregar os quadros." ou "Não foi possível carregar o quadro.", com o motivo e "Tentar de novo"               | "Não foi possível carregar os processos.", com o motivo e "Tentar de novo"                         |
| Falha de gravação | Aviso acima do quadro: as últimas mudanças só valem enquanto a página estiver aberta. Botão "Tentar de novo"                    | "Falha ao salvar o rascunho. A edição continua aqui.", e o botão de salvar vira "Tentar novamente" |
| Conflito          | Aviso acima do quadro, com "Recarregar do servidor" (descarta o que mudou na página) e "Manter a minha versão" (grava por cima) | Aviso com os mesmos dois botões                                                                    |

- A edição continua valendo na tela enquanto um aviso de gravação ou de conflito está aberto.
- No editor, a ação do catálogo (criar, renomear, arquivar) que não chega ao servidor mostra "O catálogo de processos não pôde ser gravado no servidor.", com "Tentar de novo".
- No editor, se "Recarregar do servidor" falha, o aviso "Os processos não puderam ser recarregados." traz o motivo, e a tela continua com o que tinha.
- A lista de execuções e o diagrama também mostram a espera e o erro de leitura com "Tentar de novo". A lista lê todos os quadros: se um deles falha, ela mostra os outros e avisa que pode estar incompleta.

### Aviso de saída

Com a API, o quadro não tem cópia local: a mudança que ainda não chegou ao servidor se perde se a aba fechar. Enquanto o quadro tem envio pendente, falha de gravação ou conflito sem escolha, fechar ou recarregar a aba passa pelo aviso de saída do navegador, com o texto do próprio navegador. Sem a API a gravação é imediata, e o aviso não aparece. O editor não tem esse aviso: ele grava por botão, e a barra do rascunho mostra "Alterações não salvas.".

## Estrutura

```text
apps/backoffice/
├── next.config.js            # output standalone, allowedDevOrigins, Sass
├── .env.example
├── public/
└── src/
    ├── app/                  # rotas (App Router)
    │   ├── layout.tsx        # raiz: <html lang="pt-BR">, tema, estilos, providers
    │   ├── providers.tsx     # SessionProvider + ToastProvider
    │   ├── error.tsx         # erro inesperado de uma página, inclusive do painel
    │   ├── global-error.tsx  # erro do próprio layout raiz, com <html> e <body>
    │   ├── error-screen.tsx  # a tela que os dois reaproveitam (só o digest, nunca a mensagem)
    │   ├── not-found.tsx     # 404 fora do painel (sem menu)
    │   └── (painel)/         # grupo de rotas que ganha o shell
    │       ├── layout.tsx    # envolve as páginas no DefaultLayout
    │       ├── page.tsx      # início
    │       ├── quadro/       # quadro de tarefas: telas e hooks na raiz da pasta
    │       │   ├── model/    # regras puras: cards, hierarquia, dependências, regras do quadro, processo no card e o formato gravado
    │       │   ├── commands/ # comandos que as telas despacham, por assunto
    │       │   ├── store/    # portas BoardStore e WorkspaceStore, com o adaptador do navegador e o da API
    │       │   ├── details/  # painel do card, com as seções "Processo" e "Dependências"
    │       │   ├── dialogs/  # janelas do quadro, como "Configurar quadro"
    │       │   └── toolbar/  # busca, filtros e troca de visão
    │       ├── processos/    # editor e catálogo de processos (React Flow, ADR 0016)
    │       │   ├── model/    # regras puras do desenho, validação e compilação para o roteiro
    │       │   ├── nodes/, edges/, properties/   # blocos, conexões e painel de propriedades
    │       │   ├── viewer/   # diagrama somente leitura da execução
    │       │   └── execucao/ # rota /processos/execucao: lista de execuções e diagrama (ADR 0017)
    │       └── sem-acesso/   # destino de quem não tem nenhuma permissão
    ├── core/
    │   ├── config/           # configuração pública (NEXT_PUBLIC_*)
    │   └── session/          # contrato Session e SessionProvider provisório
    ├── layout/               # o shell do CoreUI
    │   ├── default-layout.tsx    # menu + cabeçalho + conteúdo + rodapé
    │   ├── nav.ts                # itens do menu, regra de permissão e regra do item ativo
    │   ├── routes.ts             # títulos do breadcrumb
    │   ├── breadcrumbs.ts        # cálculo da trilha
    │   ├── color-mode.ts         # chave do tema e script anti-flash
    │   └── app-*.tsx             # sidebar, header, breadcrumb, footer
    ├── shared/
    │   ├── api/              # cliente HTTP da API do painel, tipos do contrato e usePanelApi
    │   ├── board/            # chaves do localStorage do quadro, lidas pelo quadro e pela lista de execuções
    │   ├── process/          # roteiro, execução, motor, campos por etapa, catálogo e as portas entre quadro e processos
    │   ├── ui/               # EmptyState, ErrorState, LoadingState, toast, ConfirmModal, CheckField
    │   └── hooks/            # useIsClient, useColorMode, useReloadOnFocus
    ├── icons/brand.ts        # logo e signet (marca neutra)
    └── scss/                 # estilos do CoreUI, tema e ajustes
```

O alias `@/` aponta para `src/`, no TypeScript e no Vitest.

### Fronteiras

- A dependência aponta para dentro: `app` usa `layout`, `shared` e `core`, e nenhum deles importa `app`.
- `quadro` e `processos` **não se importam**, em nenhum sentido. Os dois dependem de `src/shared/process`, que não usa o React Flow nem o modelo do editor.
- O React Flow (`@xyflow/react`) só entra em `src/app/(painel)/processos`. É por isso que o diagrama da execução de um card fica em `/processos/execucao`, e o card só tem o link.
- Os quadros e os processos passam por portas com dois adaptadores, o do navegador e o da API: `quadro/store` (quadros), `src/shared/process/catalog-store.ts` (catálogo) e `src/shared/process/board-runs-source.ts` (execuções em andamento). O `fetch` só existe em `src/shared/api`.
- A situação de uma execução vai do quadro para o diagrama pela porta `src/shared/process/run-view-store.ts`, que a guarda no navegador. Com a API, o diagrama lê o quadro e o processo do servidor.

## Como o shell funciona

- **Layout do painel**: toda página em `src/app/(painel)` passa por `DefaultLayout`. Rotas fora do grupo, como a 404, não têm menu nem cabeçalho.
- **Sessão**: `DefaultLayout` consulta `useSession()` e troca a página pelo estado da sessão enquanto ela não está `ready` (`loading`, `error` e `expired` mostram `LoadingState` ou `ErrorState`; sem `signIn`, a sessão expirada oferece só "Recarregar"). O `error` da sessão é um texto seguro para o usuário.
- **Menu**: `navItems` (em `nav.ts`) é filtrado por `buildNav(items, permissions)`. Item sem `permission` aparece para todos; grupo sem filhos e título sem itens somem.
  - **Hierarquia**: a rota filha de outra entra como filho do grupo do pai. "Processos" é um grupo, com os filhos "Editor" (`/processos`) e "Execuções" (`/processos/execucao`).
  - **Item ativo**: só um item fica ativo, o de endereço mais longo entre os que casam com a rota (`activeHref`). Em `/processos/execucao` é "Execuções", e não "Editor". O grupo abre quando um filho está ativo.
  - **Menu estreito**: enquanto o foco do teclado está dentro dele, o menu fica inteiro, para os filhos do grupo ficarem ao alcance de quem não usa o ponteiro.
- **Breadcrumb**: calculado a partir da URL e dos títulos de `routes.ts`. Segmentos `:id` aceitam qualquer valor, e a rota fixa vence a parametrizada.
- **Tema**: o hook `useColorMode` (`shared/hooks`) guarda a escolha no `localStorage` (chave `backoffice-theme`); sem escolha, o tema é automático e segue o sistema. Com o armazenamento bloqueado ou cheio, a escolha vale só na página aberta, sem derrubar o cabeçalho. Um script no `<head>` aplica o tema antes da hidratação para evitar o flash.

## Como estender

| Quero…                            | Onde mexer                                                                                                       |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Criar uma página                  | `src/app/(painel)/<rota>/page.tsx`, `nav.ts` e `routes.ts` ([guia](../../docs/guides/backoffice-nova-pagina.md)) |
| Mostrar carregando, vazio ou erro | `LoadingState`, `EmptyState` e `ErrorState` de `@/shared/ui/states`                                              |
| Avisar o usuário                  | `useToast()` de `@/shared/ui/toast` (`success`, `info`, `warning`, `danger`)                                     |
| Pedir confirmação                 | `ConfirmModal` de `@/shared/ui/confirm-modal`                                                                    |
| Pôr uma caixa de marcação         | `CheckField` de `@/shared/ui/check-field`, que mantém o foco na caixa depois de marcar                           |
| Ligar o login de verdade          | Passar uma `Session` real em `value` ao `SessionProvider`, em `src/app/providers.tsx`                            |
| Trocar a marca                    | `logo` e `signet` em `src/icons/brand.ts`, mantendo o formato do `@coreui/icons`                                 |
| Ajustar cores e espaçamentos      | `src/scss/_theme.scss` e `src/scss/_custom.scss`                                                                 |
| Adicionar uma variável pública    | `.env.example` e `src/core/config/app-config.ts`                                                                 |
| Ler ou gravar pela API do painel  | `usePanelApi()` de `@/shared/api/panel-api-context`; o contrato muda primeiro em `apps/backoffice-mock`          |

### Sessão provisória

Hoje o `SessionProvider` entrega uma sessão fixa: pronta, com o usuário "Usuário" e **sem permissões**. Itens do menu com `permission` não aparecem, e nada bloqueia o acesso direto a uma URL. O filtro do menu é conveniência de interface, não segurança: a autorização de verdade precisa existir no servidor que serve os dados.

## Testes

### Unitários

Vitest com jsdom, em arquivos `*.spec.ts` e `*.spec.tsx` ao lado do código. A meta é cobertura acima de 90% em linhas e ramos, conferida quando a cobertura é pedida (`VITEST_COVERAGE=1`).

| Pasta                               | O que os testes cobrem                                                             |
| ----------------------------------- | ---------------------------------------------------------------------------------- |
| `src/layout`                        | Menu (permissão, hierarquia e item ativo), breadcrumb, cabeçalho, rodapé e tema    |
| `src/shared/api`                    | Cliente HTTP, erros como valor, revisão e `If-Match`, gravação em série            |
| `src/shared/process`                | Roteiro, motor da execução, campos por etapa, catálogo e as portas, nos dois modos |
| `src/app/(painel)/quadro`           | Modelo e comandos do quadro, portas de armazenamento e as telas, nos dois modos    |
| `src/app/(painel)/processos`        | Modelo do desenho, editor, catálogo, diagrama da execução e lista de execuções     |
| `src/shared/ui`, `src/shared/hooks` | Estados de tela, toast, modal de confirmação, caixa de marcação e os hooks         |
| `src/core`, `src/app`               | Configuração pública, sessão, telas de erro e página 404                           |

- Sem `NEXT_PUBLIC_API_URL`, a tela do teste guarda no navegador. Para testar com a API, envolva a tela em `<PanelApiProvider>` com as APIs simuladas: `createFakeBoardsApi` (`quadro/store/boards-api-test-kit.ts`) e `fakeDefinitionsApi` (`src/shared/process/definitions-api-fake.ts`).
- Os testes do editor no jsdom usam os mocks de `processos/react-flow-test-setup.ts`; o arraste e a conexão reais ficam no e2e.

### Amostras de conformidade

Dois testes montam, com o código do painel, um documento de quadro e um de processo e os comparam com os arquivos de `apps/backoffice-mock/samples/`, que o projeto do mock valida contra o contrato. Quando o formato gravado muda, o teste falha e diz como regravar a amostra, com `UPDATE_SAMPLES=1`. O passo a passo está no [`README.md` do mock](../backoffice-mock/README.md#amostras-gravadas-pelo-painel).

### E2E

Playwright, em `apps/backoffice-e2e`: o shell (menu, tema e página 404), o quadro e o editor de processos. O painel do e2e roda ligado à API e exige o mock no ar (`pnpm nx run backoffice-mock:up`). Por padrão roda só o Chromium; `pnpm e2e:full` (`E2E_ALL_BROWSERS=1`) liga Firefox e WebKit. Localmente o servidor de desenvolvimento é acessado por `http://127.0.0.1:3000`; por isso `allowedDevOrigins` inclui esse endereço.

## Build e deploy

`next.config.js` usa `output: 'standalone'` e `outputFileTracingRoot` na raiz do monorepo, para levar as dependências do workspace pnpm junto. Esse é o artefato previsto para a AWS (Lambda ou container). O deploy do backoffice ainda não existe: está no roadmap em [`docs/architecture/overview.md`](../../docs/architecture/overview.md).

## Cuidados com o Next.js

Esta versão do Next.js tem mudanças que o treino de assistentes pode não conhecer. Antes de escrever código novo, leia o guia correspondente em `node_modules/next/dist/docs/`.

O painel usa **Cache Components com Partial Prefetching** (`cacheComponents` e `partialPrefetching` no `next.config.js`). Dado por requisição (`cookies()`, `headers()`, `searchParams`, tempo atual) vai dentro de `<Suspense>`, e dado cacheável vai com `'use cache'`, `cacheLife` e `cacheTag`. A conferência é a tabela de rotas do `pnpm nx build backoffice`: hoje todas as rotas saem `○ (Static)`. A rota `/processos/execucao` lê o `ref` do endereço só no navegador, para continuar estática. As convenções completas estão na rule [`nextjs-16`](./.agents/rules/nextjs-16.md).

Para agentes de IA:

- o [`AGENTS.md`](./AGENTS.md) deste projeto traz as instruções do painel e, no fim, o bloco mantido pelo próprio `next dev`; o [`CLAUDE.md`](./CLAUDE.md) só o importa, para o Claude Code;
- a rule [`.agents/rules/nextjs-16.md`](./.agents/rules/nextjs-16.md) lista o que o modelo costuma escrever errado no Next 16.4 e carrega ao mexer em `src/` ou no `next.config.js`;
- o MCP `next-devtools` (`.mcp.json` da raiz, `next-devtools-mcp@0.4.0`) dá ao agente os erros, os logs e as rotas do servidor de desenvolvimento, e por isso exige o `pnpm nx dev backoffice` rodando;
- na dúvida, a documentação da versão está no Context7 (`/vercel/next.js/v16.4.5`).
