'use client';

import { CAlert } from '@coreui/react';
import { useId, useRef, useState } from 'react';

import { useIsClient } from '@/shared/hooks/use-is-client';

import { CardDetailsPanel } from './details/card-details-panel';
import { ArchiveDialog } from './dialogs/archive-dialog';
import {
  type BoardDialog,
  type BoardDialogHandlers,
  type BoardDialogRequest,
  BoardDialogs,
} from './dialogs/board-dialogs';
import { LabelsDialog } from './dialogs/labels-dialog';
import { InlineAddForm } from './inline-add-form';
import { KanbanCard, type KanbanCardActions } from './kanban-card';
import { KanbanLane } from './kanban-lane';
import type { LaneHeaderActions } from './kanban-lane-header';
import {
  announcementText,
  laneAnnouncementText,
  type MoveAnnouncement,
} from './model/announcements';
import {
  allCards,
  type BoardCard,
  type BoardLabel,
  type BoardLane,
  findCard,
  type StepDirection,
  stepCard,
} from './model/board';
import { cardKey } from './model/card-key';
import { todayIso } from './model/due';
import { childCounts } from './model/hierarchy';
import { cardLabels } from './model/labels';
import { type LaneDirection, stepLane } from './model/lanes';
import { cardMatchesLabels, cardMatchesQuery } from './model/search';
import { BoardToolbar } from './toolbar/board-toolbar';
import { useBoard } from './use-board';
import { useBoardShortcuts } from './use-board-shortcuts';
import { useCardUrl } from './use-card-url';
import { useCollapsedLanes } from './use-collapsed-lanes';
import { useDragAndDrop } from './use-drag-and-drop';
import {
  CARD_STEP_KEYS,
  LANE_STEP_KEYS,
  useKeyboardMove,
} from './use-keyboard-move';
import { useLaneDrag } from './use-lane-drag';

interface MoveStep<Direction> {
  readonly lanes: readonly BoardLane[];
  readonly id: string;
  readonly direction: Direction;
}

interface MoveEvent {
  readonly kind: MoveAnnouncement;
  readonly lanes: readonly BoardLane[];
  readonly id: string;
}

const stepCardById = ({ lanes, id, direction }: MoveStep<StepDirection>) =>
  stepCard({ lanes, cardId: id, direction });
const cardMoveAnnouncement = ({ kind, lanes, id }: MoveEvent) =>
  announcementText({ kind, lanes, cardId: id });
const stepLaneById = ({ lanes, id, direction }: MoveStep<LaneDirection>) =>
  stepLane({ lanes, laneId: id, direction });
const laneMoveAnnouncement = ({ kind, lanes, id }: MoveEvent) =>
  laneAnnouncementText({ kind, lanes, laneId: id });

/** Passos do teclado entram no mesmo passo do desfazer até o item ser solto. */
const KEYBOARD_MOVE = 'keyboard';

/** Card mostrado no painel de detalhes; `open` falso mantém o conteúdo enquanto o painel sai da tela. */
interface OpenCard {
  readonly id: string;
  readonly open: boolean;
}

/** Aviso visível acima do quadro: link copiado, card do endereço que não pode ser aberto. */
interface Notice {
  readonly color: 'success' | 'warning';
  readonly text: string;
}

type FocusTarget =
  | 'data-card-open'
  | 'data-lane-title'
  | 'data-board-reset'
  | 'data-board-archive'
  | 'data-board-labels'
  | 'data-board-undo';

/** Colunas recolhidas que vão receber um card que ainda não está nelas. */
function lanesReceiving(params: {
  readonly before: readonly BoardLane[];
  readonly after: readonly BoardLane[];
  readonly collapsed: ReadonlySet<string>;
}): readonly string[] {
  return params.after
    .filter((lane) => {
      if (!params.collapsed.has(lane.id)) {
        return false;
      }
      const previous = params.before.find((item) => item.id === lane.id);
      return lane.cards.some(
        (card) => !previous?.cards.some((item) => item.id === card.id),
      );
    })
    .map((lane) => lane.id);
}

/**
 * Quadro kanban: colunas e cards criados, movidos (arrastando ou pelo teclado) e editados, com busca, filtro por
 * etiqueta, desfazer, arquivo, painel de detalhes com hierarquia e histórico, e o card aberto no endereço da página.
 * Com `storageKey`, o quadro fica gravado no navegador.
 */
export function KanbanBoard({
  initialLanes,
  initialLabels,
  storageKey,
}: Readonly<{
  initialLanes: readonly BoardLane[];
  initialLabels?: readonly BoardLabel[];
  storageKey?: string;
}>) {
  const { board, canUndo, canRedo, loaded, commands } = useBoard({
    initialLanes,
    initialLabels,
    storageKey,
  });
  const { lanes, labels } = board;
  const collapsedLanes = useCollapsedLanes(storageKey);
  const { collapsed } = collapsedLanes;
  const isClient = useIsClient();
  const today = isClient ? todayIso() : undefined;
  const [announcement, setAnnouncement] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [query, setQuery] = useState('');
  const [labelFilter, setLabelFilter] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [openCard, setOpenCard] = useState<OpenCard | null>(null);
  const [dialog, setDialog] = useState<BoardDialog | null>(null);
  const [listDialog, setListDialog] = useState<'archive' | 'labels' | null>(
    null,
  );
  const dialogCount = useRef(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const instructionsId = useId();

  const cardKeyboard = useKeyboardMove({
    lanes,
    setLanes: (next) => {
      // WHY: o card levado pelo teclado para uma coluna recolhida precisa da alça na tela para continuar com o foco.
      const receiving = lanesReceiving({
        before: lanes,
        after: next,
        collapsed,
      });
      if (receiving.length > 0) {
        collapsedLanes.expand(receiving);
      }
      commands.setLanes(next, KEYBOARD_MOVE);
    },
    announce: setAnnouncement,
    keys: CARD_STEP_KEYS,
    step: stepCardById,
    announcementFor: cardMoveAnnouncement,
  });
  const laneKeyboard = useKeyboardMove({
    lanes,
    setLanes: (next) => commands.setLanes(next, KEYBOARD_MOVE),
    announce: setAnnouncement,
    keys: LANE_STEP_KEYS,
    step: stepLaneById,
    announcementFor: laneMoveAnnouncement,
  });
  const releaseKeyboard = () => {
    cardKeyboard.release();
    laneKeyboard.release();
  };
  const cardDrag = useDragAndDrop({
    lanes,
    onDragStart: releaseKeyboard,
    onDrop: (drop) => {
      commands.setLanes(drop.lanes);
      setAnnouncement(
        announcementText({
          kind: 'dropped',
          lanes: drop.lanes,
          cardId: drop.cardId,
        }),
      );
    },
  });
  const laneDrag = useLaneDrag({
    lanes,
    onDragStart: releaseKeyboard,
    onDrop: (drop) => {
      commands.setLanes(drop.lanes);
      setAnnouncement(
        laneAnnouncementText({
          kind: 'dropped',
          lanes: drop.lanes,
          laneId: drop.laneId,
        }),
      );
    },
  });

  const openLocation = openCard
    ? findCard({ lanes, cardId: openCard.id })
    : undefined;
  const panelVisible = Boolean(openCard?.open && openLocation);

  /** Foca o elemento do quadro marcado com `attribute` igual a `id`. */
  function focusMarked(target: {
    readonly attribute: FocusTarget;
    readonly id: string;
  }) {
    Array.from(
      rootRef.current?.querySelectorAll<HTMLElement>(`[${target.attribute}]`) ??
        [],
    )
      .find(
        (candidate) => candidate.getAttribute(target.attribute) === target.id,
      )
      ?.focus();
  }

  /** Foca o título da coluna depois que a tela se atualiza (o elemento focado pode ter saído). */
  function focusLaneLater(laneId: string | undefined) {
    if (laneId) {
      requestAnimationFrame(() =>
        focusMarked({ attribute: 'data-lane-title', id: laneId }),
      );
    }
  }

  function openDetails(cardId: string) {
    setOpenCard({ id: cardId, open: true });
  }

  function closeDetails() {
    if (!openCard) {
      return;
    }
    setOpenCard({ id: openCard.id, open: false });
    focusMarked({ attribute: 'data-card-open', id: openCard.id });
  }

  useCardUrl({
    ready: loaded,
    board,
    openKey:
      panelVisible && openLocation ? cardKey(openLocation.card) : undefined,
    onOpen: openDetails,
    onUnavailable: (text) => setNotice({ color: 'warning', text }),
  });

  function runHistory(direction: 'undo' | 'redo') {
    if (direction === 'undo' ? !canUndo : !canRedo) {
      return;
    }
    releaseKeyboard();
    commands[direction]();
    setAnnouncement(
      direction === 'undo' ? 'Alteração desfeita.' : 'Alteração refeita.',
    );
    requestAnimationFrame(() => {
      if (document.activeElement === document.body) {
        focusMarked({ attribute: 'data-board-undo', id: '' });
      }
    });
  }

  useBoardShortcuts({
    onUndo: () => runHistory('undo'),
    onRedo: () => runHistory('redo'),
    onFocusSearch: () => searchRef.current?.focus(),
  });

  function openDialog(request: BoardDialogRequest) {
    dialogCount.current += 1;
    setDialog({ key: dialogCount.current, open: true, request });
  }

  /** Fecha a janela; quando ela termina de sair, o foco vai para o título de `focusLaneId`. */
  function closeDialog(focusLaneId: string | undefined) {
    setDialog((current) => current && { ...current, open: false, focusLaneId });
  }

  function requestForLane(kind: 'limit' | 'remove-lane', laneId: string) {
    const lane = lanes.find((candidate) => candidate.id === laneId);
    if (lane) {
      openDialog({ kind, lane });
    }
  }

  function requestCardRemoval(cardId: string) {
    const location = findCard({ lanes, cardId });
    if (!location) {
      return;
    }
    const { card } = location;
    const parent = card.parentId
      ? findCard({ lanes, cardId: card.parentId })?.card
      : undefined;
    openDialog({
      kind: 'remove-card',
      card,
      childCount: childCounts(lanes).get(card.id) ?? 0,
      parentTitle: parent?.title,
    });
  }

  function archiveFromPanel(cardId: string) {
    const location = findCard({ lanes, cardId });
    if (!location) {
      return;
    }
    commands.archiveCard(cardId);
    setAnnouncement(`Card ${location.card.title} arquivado.`);
    focusLaneLater(location.lane.id);
  }

  function duplicateFromPanel(cardId: string) {
    const location = findCard({ lanes, cardId });
    const copyId = commands.duplicateCard(cardId);
    if (location && copyId) {
      openDetails(copyId);
      setAnnouncement(`Card ${location.card.title} duplicado.`);
    }
  }

  function copyLink(cardId: string) {
    const location = findCard({ lanes, cardId });
    if (!location) {
      return;
    }
    const key = cardKey(location.card);
    const url = new URL(window.location.href);
    url.searchParams.set('card', key);
    navigator.clipboard.writeText(url.href).then(
      () =>
        setNotice({ color: 'success', text: `Link do card ${key} copiado.` }),
      () =>
        setNotice({
          color: 'warning',
          text: 'O navegador não deixou copiar o link.',
        }),
    );
  }

  function archivedTitle(entryId: string): string {
    const entry = board.archive.find((candidate) => candidate.id === entryId);
    return entry?.cards[0]?.card.title ?? '';
  }

  const dialogLaneId =
    dialog?.request.kind === 'limit' || dialog?.request.kind === 'remove-lane'
      ? dialog.request.lane.id
      : undefined;

  const dialogHandlers: BoardDialogHandlers = {
    onSaveLimit: (change) => {
      commands.setWipLimit(change);
      closeDialog(change.laneId);
    },
    onRemoveLane: (change) => {
      const lane = lanes.find((candidate) => candidate.id === change.laneId);
      const index = lanes.findIndex(
        (candidate) => candidate.id === change.laneId,
      );
      commands.removeLane(change);
      closeDialog(
        change.moveCardsTo ?? (lanes[index - 1] ?? lanes[index + 1])?.id,
      );
      setAnnouncement(`Coluna ${lane?.title} excluída.`);
    },
    onRemoveCard: (cardId) => {
      const location = findCard({ lanes, cardId });
      commands.removeCard(cardId);
      closeDialog(location?.lane.id);
      setAnnouncement(`Card ${location?.card.title} excluído.`);
    },
    onReset: () => {
      commands.reset();
      setOpenCard(null);
      closeDialog(undefined);
      setAnnouncement('Quadro de exemplo restaurado.');
    },
    onCancel: () => closeDialog(dialogLaneId),
    onClosed: (focusLaneId) =>
      focusMarked(
        focusLaneId
          ? { attribute: 'data-lane-title', id: focusLaneId }
          : { attribute: 'data-board-reset', id: '' },
      ),
  };

  const withNewGrab =
    (
      keyboard: { readonly grabbedId: string | null },
      click: (id: string) => void,
    ) =>
    (id: string) => {
      // NOTE: pegar um item abre um passo novo no desfazer; os passos das setas entram nele até soltar.
      if (keyboard.grabbedId !== id) {
        commands.seal();
      }
      click(id);
    };

  const headerActions: LaneHeaderActions = {
    onHandleDragStart: laneDrag.onDragStart,
    onHandleDragEnd: laneDrag.onDragEnd,
    onHandleClick: withNewGrab(laneKeyboard, laneKeyboard.onHandleClick),
    onHandleKeyDown: laneKeyboard.onHandleKeyDown,
    onHandleBlur: laneKeyboard.onHandleBlur,
    registerHandle: laneKeyboard.registerHandle,
    onRename: commands.renameLane,
    onRequestLimit: (laneId) => requestForLane('limit', laneId),
    onRequestRemove: (laneId) => requestForLane('remove-lane', laneId),
    onToggleCollapse: (laneId) => {
      const lane = lanes.find((candidate) => candidate.id === laneId);
      collapsedLanes.toggle(laneId);
      setAnnouncement(
        `Coluna ${lane?.title} ${collapsed.has(laneId) ? 'expandida' : 'recolhida'}.`,
      );
      focusLaneLater(laneId);
    },
  };

  const cardActions: KanbanCardActions = {
    onOpen: openDetails,
    onDragStart: cardDrag.onDragStart,
    onDragEnd: cardDrag.onDragEnd,
    onHandleClick: withNewGrab(cardKeyboard, cardKeyboard.onHandleClick),
    onHandleKeyDown: cardKeyboard.onHandleKeyDown,
    onHandleBlur: cardKeyboard.onHandleBlur,
    registerHandle: cardKeyboard.registerHandle,
  };

  const cards = allCards(lanes);
  const titles = new Map(cards.map((card) => [card.id, card.title]));
  const counts = childCounts(lanes);
  const activeLabels = new Set(
    labels
      .filter((label) => labelFilter.has(label.id))
      .map((label) => label.id),
  );
  const filtering = query.trim() !== '' || activeLabels.size > 0;
  const matches = (card: BoardCard) =>
    cardMatchesQuery({ card, query, labels }) &&
    cardMatchesLabels({ card, labelIds: activeLabels });
  const lastIndex = lanes.length - 1;

  return (
    <div ref={rootRef} className="kanban-board">
      {notice ? (
        <CAlert
          color={notice.color}
          dismissible
          className="py-2"
          onClose={() => setNotice(null)}
        >
          {notice.text}
        </CAlert>
      ) : null}
      <BoardToolbar
        instructionsId={instructionsId}
        search={{
          inputRef: searchRef,
          query,
          matchCount: filtering ? cards.filter(matches).length : null,
          totalCount: cards.length,
          onChange: setQuery,
        }}
        filter={{
          labels,
          selected: activeLabels,
          onToggle: (labelId) =>
            setLabelFilter((current) => {
              const next = new Set(current);
              if (!next.delete(labelId)) {
                next.add(labelId);
              }
              return next;
            }),
          onClear: () => setLabelFilter(new Set()),
          onManage: () => setListDialog('labels'),
        }}
        history={{
          canUndo,
          canRedo,
          onUndo: () => runHistory('undo'),
          onRedo: () => runHistory('redo'),
        }}
        archivedCount={board.archive.length}
        onOpenArchive={() => setListDialog('archive')}
        onReset={() => openDialog({ kind: 'reset' })}
      />
      {/* biome-ignore lint/a11y/noStaticElementInteractions: só recebe o arraste das colunas, que pode terminar entre duas delas; pelo teclado, a coluna se move pela alça */}
      <div
        className="kanban-board__lanes d-flex gap-3 overflow-x-auto p-2"
        onDragOver={laneDrag.onDragOver}
        onDragLeave={laneDrag.onDragLeave}
        onDrop={laneDrag.onDrop}
      >
        {lanes.map((lane, laneIndex) => {
          const cardDrop =
            cardDrag.visibleDrop?.laneId === lane.id
              ? cardDrag.visibleDrop
              : null;
          return (
            <KanbanLane
              key={lane.id}
              lane={lane}
              index={laneIndex}
              moveState={{
                dragging: laneDrag.draggedLaneId === lane.id,
                grabbed: laneKeyboard.grabbedId === lane.id,
                dropBefore: laneDrag.visibleSlot === laneIndex,
                dropAfter:
                  laneIndex === lastIndex &&
                  laneDrag.visibleSlot === lanes.length,
                cardDropAtEnd: cardDrop?.slot === lane.cards.length,
                collapsed: collapsed.has(lane.id),
              }}
              canRemove={lanes.length > 1}
              instructionsId={instructionsId}
              headerActions={headerActions}
              onDragOver={cardDrag.onDragOver}
              onDragLeave={cardDrag.onDragLeave}
              onDrop={cardDrag.onDrop}
              onAddCard={(card) => {
                if (commands.addCard(card)) {
                  setAnnouncement(
                    `Card ${card.title.trim()} criado em ${lane.title}.`,
                  );
                }
              }}
            >
              {lane.cards.map((card, index) => (
                <KanbanCard
                  key={card.id}
                  card={card}
                  index={index}
                  parentTitle={
                    card.parentId ? titles.get(card.parentId) : undefined
                  }
                  childCount={counts.get(card.id) ?? 0}
                  labels={cardLabels({ card, labels })}
                  today={today}
                  dimmed={filtering && !matches(card)}
                  open={panelVisible && openCard?.id === card.id}
                  dragging={cardDrag.draggedId === card.id}
                  grabbed={cardKeyboard.grabbedId === card.id}
                  dropBefore={cardDrop?.slot === index}
                  instructionsId={instructionsId}
                  actions={cardActions}
                />
              ))}
            </KanbanLane>
          );
        })}
        <div className="kanban-board__add-lane">
          <InlineAddForm
            buttonLabel="Adicionar coluna"
            inputLabel="Nome da nova coluna"
            onAdd={(title) => {
              if (commands.addLane(title)) {
                setAnnouncement(`Coluna ${title.trim()} criada.`);
              }
            }}
          />
        </div>
      </div>
      <CardDetailsPanel
        visible={panelVisible}
        location={openLocation}
        board={board}
        commands={commands}
        actions={{
          onOpenCard: openDetails,
          onRequestRemove: requestCardRemoval,
          onArchive: archiveFromPanel,
          onDuplicate: duplicateFromPanel,
          onCopyLink:
            isClient && typeof navigator.clipboard?.writeText === 'function'
              ? copyLink
              : undefined,
        }}
        onClose={closeDetails}
      />
      <BoardDialogs dialog={dialog} lanes={lanes} handlers={dialogHandlers} />
      <ArchiveDialog
        visible={listDialog === 'archive'}
        archive={board.archive}
        onRestore={(entryId) => {
          const title = archivedTitle(entryId);
          commands.restoreArchived(entryId);
          setAnnouncement(`Card ${title} restaurado.`);
        }}
        onDelete={(entryId) => {
          const title = archivedTitle(entryId);
          commands.deleteArchived(entryId);
          setAnnouncement(`Card ${title} excluído de vez.`);
        }}
        onClose={() => setListDialog(null)}
        onClosed={() =>
          focusMarked({ attribute: 'data-board-archive', id: '' })
        }
      />
      <LabelsDialog
        visible={listDialog === 'labels'}
        labels={labels}
        commands={commands}
        onClose={() => setListDialog(null)}
        onClosed={() => focusMarked({ attribute: 'data-board-labels', id: '' })}
      />
      <div className="visually-hidden" aria-live="assertive" aria-atomic="true">
        {announcement}
      </div>
    </div>
  );
}
