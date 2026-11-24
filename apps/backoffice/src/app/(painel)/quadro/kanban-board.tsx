'use client';

import { useId, useRef, useState } from 'react';

import {
  type BoardDialog,
  type BoardDialogHandlers,
  type BoardDialogRequest,
  BoardDialogs,
} from './board-dialogs';
import { BoardToolbar } from './board-toolbar';
import { CardDetailsPanel } from './card-details-panel';
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
  type BoardLane,
  findCard,
  type StepDirection,
  stepCard,
} from './model/board';
import { childCounts } from './model/hierarchy';
import { type LaneDirection, stepLane } from './model/lanes';
import { useBoard } from './use-board';
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

/** Card mostrado no painel de detalhes; `open` falso mantém o conteúdo enquanto o painel sai da tela. */
interface OpenCard {
  readonly id: string;
  readonly open: boolean;
}

/**
 * Quadro kanban: colunas e cards criados, renomeados, movidos (arrastando ou pelo teclado) e excluídos, com o painel
 * de detalhes do card e a hierarquia entre cards. Com `storageKey`, o quadro fica gravado no navegador.
 */
export function KanbanBoard({
  initialLanes,
  storageKey,
}: Readonly<{ initialLanes: readonly BoardLane[]; storageKey?: string }>) {
  const { lanes, setLanes, commands } = useBoard({
    initial: initialLanes,
    storageKey,
  });
  const [announcement, setAnnouncement] = useState('');
  const [openCard, setOpenCard] = useState<OpenCard | null>(null);
  const [dialog, setDialog] = useState<BoardDialog | null>(null);
  const dialogCount = useRef(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const instructionsId = useId();

  const cardKeyboard = useKeyboardMove({
    lanes,
    setLanes,
    announce: setAnnouncement,
    keys: CARD_STEP_KEYS,
    step: stepCardById,
    announcementFor: cardMoveAnnouncement,
  });
  const laneKeyboard = useKeyboardMove({
    lanes,
    setLanes,
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
      setLanes(drop.lanes);
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
      setLanes(drop.lanes);
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
    readonly attribute:
      | 'data-card-open'
      | 'data-lane-title'
      | 'data-board-reset';
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

  const headerActions: LaneHeaderActions = {
    onHandleDragStart: laneDrag.onDragStart,
    onHandleDragEnd: laneDrag.onDragEnd,
    onHandleClick: laneKeyboard.onHandleClick,
    onHandleKeyDown: laneKeyboard.onHandleKeyDown,
    onHandleBlur: laneKeyboard.onHandleBlur,
    registerHandle: laneKeyboard.registerHandle,
    onRename: commands.renameLane,
    onRequestLimit: (laneId) => requestForLane('limit', laneId),
    onRequestRemove: (laneId) => requestForLane('remove-lane', laneId),
  };

  const cardActions: KanbanCardActions = {
    onOpen: openDetails,
    onDragStart: cardDrag.onDragStart,
    onDragEnd: cardDrag.onDragEnd,
    onHandleClick: cardKeyboard.onHandleClick,
    onHandleKeyDown: cardKeyboard.onHandleKeyDown,
    onHandleBlur: cardKeyboard.onHandleBlur,
    registerHandle: cardKeyboard.registerHandle,
  };

  const titles = new Map(allCards(lanes).map((card) => [card.id, card.title]));
  const counts = childCounts(lanes);
  const lastIndex = lanes.length - 1;

  return (
    <div ref={rootRef} className="kanban-board">
      <BoardToolbar
        instructionsId={instructionsId}
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
        lanes={lanes}
        commands={commands}
        onOpenCard={openDetails}
        onRequestRemove={requestCardRemoval}
        onClose={closeDetails}
      />
      <BoardDialogs dialog={dialog} lanes={lanes} handlers={dialogHandlers} />
      <div className="visually-hidden" aria-live="assertive" aria-atomic="true">
        {announcement}
      </div>
    </div>
  );
}
