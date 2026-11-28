import { allCards } from './model/board';
import { BoardToolbar } from './toolbar/board-toolbar';
import { hiddenLanesProps } from './toolbar/hidden-lanes-props';
import type { BoardScreen } from './use-board-screen';

export interface BoardToolbarAreaProps {
  readonly screen: BoardScreen;
  /** O quadro tem a janela "Configurar quadro". */
  readonly hasSettings: boolean;
  /** O quadro tem conteúdo de exemplo para restaurar. */
  readonly canReset: boolean;
}

/** Barra do quadro ligada ao estado da tela: busca, filtro, histórico, visão, colunas ocultas e ações gerais. */
export function BoardToolbarArea({
  screen,
  hasSettings,
  canReset,
}: Readonly<BoardToolbarAreaProps>) {
  const { board, commands, filter, focus, history } = screen;
  const { listDialogs, dialogs } = screen.windows;
  const cards = allCards(screen.shown);
  const matchCount = filter.filtering
    ? cards.filter(filter.matches).length
    : null;

  return (
    <BoardToolbar
      instructionsId={screen.instructionsId}
      search={{
        inputRef: screen.searchRef,
        query: filter.query,
        matchCount,
        totalCount: cards.length,
        onChange: filter.setQuery,
      }}
      filter={{
        labels: board.labels,
        selected: filter.activeLabels,
        onToggle: filter.toggleLabel,
        onClear: filter.clearLabels,
        onManage: () => listDialogs.show('labels'),
      }}
      hierarchy={{ value: filter.hierarchy, onChange: filter.setHierarchy }}
      history={{
        canUndo: screen.canUndo,
        canRedo: screen.canRedo,
        onUndo: history.undo,
        onRedo: history.redo,
      }}
      view={{ view: screen.view, onChange: screen.setView }}
      hiddenLanes={hiddenLanesProps({ board, commands, focus })}
      archivedCount={board.archive.length}
      onOpenArchive={() => listDialogs.show('archive')}
      onOpenSettings={
        hasSettings ? () => listDialogs.show('settings') : undefined
      }
      onReset={canReset ? dialogs.requestReset : undefined}
    />
  );
}
