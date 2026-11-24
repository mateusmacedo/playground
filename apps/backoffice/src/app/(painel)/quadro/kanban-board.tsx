'use client';

import { BoardNotices } from './board-notices';
import { BoardOverlays } from './board-overlays';
import { BoardToolbarArea } from './board-toolbar-area';
import { BoardViews } from './board-views';
import type { BoardSettings } from './dialogs/board-settings-dialog';
import type { BoardLabel, BoardLane } from './model/board';
import { useBoardScreen } from './use-board-screen';

export interface KanbanBoardProps {
  readonly initialLanes: readonly BoardLane[];
  readonly initialLabels?: readonly BoardLabel[];
  readonly storageKey?: string;
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
 * Com `storageKey`, o quadro fica gravado no navegador.
 *
 * NOTE: o estado da tela é montado em `useBoardScreen`; aqui fica só o layout, em quatro áreas.
 */
export function KanbanBoard({
  initialLanes,
  initialLabels,
  storageKey,
  settings,
  canReset = true,
  author = 'Você',
}: Readonly<KanbanBoardProps>) {
  const screen = useBoardScreen({ initialLanes, initialLabels, storageKey });
  const { feedback } = screen;

  return (
    <div ref={screen.focus.rootRef} className="kanban-board">
      <BoardNotices
        storageFull={screen.storageFull}
        notice={feedback.notice}
        onDismiss={feedback.dismissNotice}
      />
      <BoardToolbarArea
        screen={screen}
        hasSettings={settings !== undefined}
        canReset={canReset}
      />
      <BoardViews screen={screen} />
      <BoardOverlays screen={screen} settings={settings} author={author} />
      <div className="visually-hidden" aria-live="assertive" aria-atomic="true">
        {feedback.announcement}
      </div>
    </div>
  );
}
