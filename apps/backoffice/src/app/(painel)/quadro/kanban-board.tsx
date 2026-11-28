'use client';

import { BoardLoadState } from './board-load-state';
import { BoardNotices } from './board-notices';
import { BoardOverlays } from './board-overlays';
import { BoardToolbarArea } from './board-toolbar-area';
import { BoardViews } from './board-views';
import type { BoardSettings } from './dialogs/board-settings-dialog';
import type { BoardLabel, BoardLane } from './model/board';
import type { BoardStore } from './store/board-store';
import { useBoardScreen } from './use-board-screen';
import { ProcessBoardProvider } from './use-process-board';

export interface KanbanBoardProps {
  readonly initialLanes: readonly BoardLane[];
  readonly initialLabels?: readonly BoardLabel[];
  /** Chave do quadro no navegador: guarda as preferências de tela e, sem `store`, o próprio quadro. */
  readonly storageKey?: string;
  /** Onde o quadro é lido e gravado, quando não é na chave do navegador. */
  readonly store?: BoardStore;
  /** Com ela, o quadro ganha a janela "Configurar quadro", com nome e prefixo do código. */
  readonly settings?: BoardSettings;
  /** O quadro tem conteúdo de exemplo para restaurar. */
  readonly canReset?: boolean;
  /** Nome de quem comenta nos cards. */
  readonly author?: string;
}

/**
 * Quadro kanban: colunas e cards criados, movidos (arrastando ou pelo teclado) e editados, com busca, filtro por
 * etiqueta, desfazer, arquivo, painel de detalhes com hierarquia e histórico, e o card aberto no endereço da página.
 * Com `storageKey`, o quadro fica gravado no navegador; com `store`, onde ele disser. O quadro que vem de um servidor
 * dá lugar ao aviso de carregando, e ao de erro com nova tentativa, enquanto não chega.
 *
 * NOTE: o estado da tela é montado em `useBoardScreen`; aqui fica só o layout, em quatro áreas.
 */
export function KanbanBoard({
  initialLanes,
  initialLabels,
  storageKey,
  store,
  settings,
  canReset = true,
  author = 'Você',
}: Readonly<KanbanBoardProps>) {
  const screen = useBoardScreen({
    initialLanes,
    initialLabels,
    storageKey,
    store,
  });
  const { feedback, storage } = screen;

  if (storage.phase.kind !== 'ready') {
    return (
      <div ref={screen.focus.rootRef} className="kanban-board">
        <BoardLoadState
          phase={storage.phase}
          loadingLabel="Carregando o quadro…"
          failedMessage="Não foi possível carregar o quadro."
          onRetry={storage.retryLoad}
        />
      </div>
    );
  }

  return (
    <div ref={screen.focus.rootRef} className="kanban-board">
      <BoardNotices
        save={storage.save}
        saveActions={storage.saveActions}
        notice={feedback.notice}
        onDismiss={feedback.dismissNotice}
      />
      <BoardToolbarArea
        screen={screen}
        hasSettings={settings !== undefined}
        canReset={canReset}
      />
      <ProcessBoardProvider board={screen.board} flush={storage.flush}>
        <BoardViews screen={screen} />
        <BoardOverlays screen={screen} settings={settings} author={author} />
      </ProcessBoardProvider>
      <div
        className="visually-hidden"
        role="status"
        aria-label="Avisos do quadro"
        aria-live="assertive"
        aria-atomic="true"
      >
        {feedback.announcement}
      </div>
    </div>
  );
}
