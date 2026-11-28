import { ArchiveLane } from './archive-lane';
import { BoardLanes } from './board-lanes';
import { BoardList } from './board-list';
import { cardRenderer } from './card-renderer';
import type { KanbanCardActions, RenderCard } from './kanban-card';
import type { NewCard } from './kanban-lane';
import { laneHeaderActions } from './lane-header-actions';
import { listTree } from './list-tree';
import { type CardLookups, cardLookups } from './model/card-lookups';
import { groupByParent, listRows, sortRows } from './model/views';
import { PendingStepsView } from './pending-steps-view';
import { Swimlanes } from './swimlanes';
import type { BoardScreen } from './use-board-screen';

export interface BoardViewsProps {
  readonly screen: BoardScreen;
}

/** A visão escolhida na barra: as etapas pendentes, a lista, as linhas por card pai ou as colunas. */
export function BoardViews({ screen }: Readonly<BoardViewsProps>) {
  const { board, shown, view, moves } = screen;
  const { panel } = screen.windows;

  if (view.mode === 'steps') {
    return (
      <PendingStepsView
        board={board}
        filter={screen.filter}
        isClient={screen.isClient}
        onOpen={panel.open}
      />
    );
  }

  const lookups = cardLookups({ board, shown });

  if (view.mode === 'list') {
    return <ListView screen={screen} lookups={lookups} />;
  }

  const cardActions: KanbanCardActions = {
    onOpen: panel.open,
    onDragStart: moves.drags.card.onDragStart,
    onDragEnd: moves.drags.card.onDragEnd,
    onHandleClick: moves.keyboard.onCardHandleClick,
    onHandleKeyDown: moves.keyboard.card.onHandleKeyDown,
    onHandleBlur: moves.keyboard.card.onHandleBlur,
    registerHandle: moves.keyboard.card.registerHandle,
  };
  const renderCard = cardRenderer({
    lookups,
    labels: board.labels,
    keyPrefix: board.config.keyPrefix,
    today: screen.today,
    filter: screen.filter,
    shownCardId: panel.shownCardId,
    draggedId: moves.drags.card.draggedId,
    grabbedId: moves.keyboard.card.grabbedId,
    instructionsId: screen.instructionsId,
    actions: cardActions,
  });

  if (view.grouped) {
    return (
      <Swimlanes
        groups={groupByParent({ lanes: shown, allLanes: board.lanes })}
        keyPrefix={board.config.keyPrefix}
        progress={lookups.progress}
        dropTarget={moves.swimlaneDrop.target}
        renderCard={renderCard}
        onDragOver={moves.swimlaneDrop.onDragOver}
        onDragLeave={moves.swimlaneDrop.onDragLeave}
        onDrop={moves.swimlaneDrop.onDrop}
      />
    );
  }
  return <LanesView screen={screen} renderCard={renderCard} />;
}

interface ListViewProps {
  readonly screen: BoardScreen;
  readonly lookups: CardLookups;
}

/**
 * Visão em lista: os cards das colunas visíveis que passam no filtro, na ordem escolhida. Em árvore, cada card fica
 * abaixo do pai, e a ordem vale dentro de cada nível.
 */
function ListView({ screen, lookups }: Readonly<ListViewProps>) {
  const { board, shown, filter, listSort, view, setView } = screen;
  const allRows = listRows({ lanes: shown, people: lookups.people });
  const filteredRows = filter.filtering
    ? allRows.filter((row) => filter.matches(row.card))
    : allRows;
  const sortedRows = sortRows({ rows: filteredRows, sort: listSort.sort });
  const tree = view.tree
    ? listTree({
        rows: sortedRows,
        collapsedRows: view.collapsedRows,
        onChange: (collapsedRows) => setView({ collapsedRows }),
      })
    : undefined;

  return (
    <BoardList
      rows={tree ? tree.rows : sortedRows}
      tree={tree}
      keyPrefix={board.config.keyPrefix}
      labels={board.labels}
      today={screen.today}
      progress={lookups.progress}
      blocked={lookups.blocked}
      sort={listSort.sort}
      onSort={listSort.sortBy}
      onOpen={screen.windows.panel.open}
    />
  );
}

interface LanesViewProps {
  readonly screen: BoardScreen;
  readonly renderCard: RenderCard;
}

/** Visão em colunas, com a coluna de arquivados no fim. */
function LanesView({ screen, renderCard }: Readonly<LanesViewProps>) {
  const { board, shown, commands, collapsedLanes, moves, focus } = screen;
  const { announce } = screen.feedback;
  const { archiveView, dialogs } = screen.windows;

  function addCard(card: NewCard) {
    if (!commands.addCard(card)) {
      return;
    }
    const lane = board.lanes.find((candidate) => candidate.id === card.laneId);
    announce(`Card ${card.title.trim()} criado em ${lane?.title}.`);
  }

  function addLane(title: string) {
    if (commands.addLane(title)) {
      announce(`Coluna ${title.trim()} criada.`);
    }
  }

  function hideArchiveLane() {
    commands.setArchiveLaneHidden(true);
    announce('Coluna Arquivados oculta.');
    focus.focusMarked({ attribute: 'data-board-archive', id: '' });
  }

  const headerActions = laneHeaderActions({
    lanes: board.lanes,
    shown,
    commands,
    collapsedLanes,
    keyboard: moves.keyboard,
    drag: moves.drags.lane,
    dialogs,
    announce,
    focus,
  });
  const archiveLane = board.config.archiveLaneHidden ? null : (
    <ArchiveLane
      archive={board.archive}
      keyPrefix={board.config.keyPrefix}
      dropActive={moves.archiveDrop.active}
      onDragOver={moves.archiveDrop.onDragOver}
      onDragLeave={moves.archiveDrop.onDragLeave}
      onDrop={moves.archiveDrop.onDrop}
      onOpen={archiveView.show}
      onHide={hideArchiveLane}
    />
  );

  return (
    <BoardLanes
      lanes={shown}
      totalLanes={board.lanes.length}
      collapsed={collapsedLanes.collapsed}
      drags={moves.drags}
      grabbedLaneId={moves.keyboard.lane.grabbedId}
      instructionsId={screen.instructionsId}
      headerActions={headerActions}
      renderCard={renderCard}
      onAddCard={addCard}
      onAddLane={addLane}
      archiveLane={archiveLane}
    />
  );
}
