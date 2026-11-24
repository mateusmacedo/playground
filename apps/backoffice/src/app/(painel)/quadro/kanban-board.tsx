'use client';

import { CAlert } from '@coreui/react';
import { type DragEvent, useId, useRef, useState } from 'react';

import { useIsClient } from '@/shared/hooks/use-is-client';

import { ArchiveLane } from './archive-lane';
import { BoardList } from './board-list';
import { CardDetailsPanel } from './details/card-details-panel';
import { ArchiveDialog } from './dialogs/archive-dialog';
import {
  ArchivedCardDialog,
  type ArchivedView,
} from './dialogs/archived-card-dialog';
import {
  type BoardDialog,
  type BoardDialogHandlers,
  type BoardDialogRequest,
  BoardDialogs,
} from './dialogs/board-dialogs';
import { BoardFormDialog } from './dialogs/board-form-dialog';
import { LabelsDialog } from './dialogs/labels-dialog';
import { OnClosed } from './dialogs/on-closed';
import { InlineAddForm } from './inline-add-form';
import { KanbanCard, type KanbanCardActions } from './kanban-card';
import { KanbanLane } from './kanban-lane';
import type { LaneHeaderActions } from './kanban-lane-header';
import {
  announcementText,
  laneAnnouncementText,
  type MoveAnnouncement,
} from './model/announcements';
import { restoreArchived } from './model/archive';
import {
  allCards,
  type Board,
  type BoardCard,
  type BoardLabel,
  type BoardLane,
  findCard,
  type StepDirection,
  stepCard,
} from './model/board';
import { cardKey } from './model/card-key';
import { childProgress } from './model/completion';
import { todayIso } from './model/due';
import { childCounts } from './model/hierarchy';
import { cardLabels } from './model/labels';
import {
  brokenLock,
  mergeVisible,
  respectsLocks,
  visibleLanes,
} from './model/lane-state';
import { type LaneDirection, stepLane } from './model/lanes';
import { cardMatchesLabels, cardMatchesQuery } from './model/search';
import {
  groupByParent,
  type ListSort,
  type ListSortKey,
  listRows,
  sortRows,
} from './model/views';
import { type CellTarget, cellId, Swimlanes } from './swimlanes';
import { BoardToolbar } from './toolbar/board-toolbar';
import { useBoard } from './use-board';
import { useBoardShortcuts } from './use-board-shortcuts';
import { useBoardView } from './use-board-view';
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

/** Passo do card pelo teclado; o passo que mexe numa coluna bloqueada não acontece. */
const stepCardById = ({ lanes, id, direction }: MoveStep<StepDirection>) => {
  const next = stepCard({ lanes, cardId: id, direction });
  return respectsLocks({ before: lanes, after: next }) ? next : lanes;
};
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

/** Card arquivado aberto só para leitura; `open` falso mantém o conteúdo enquanto a janela sai da tela. */
interface OpenArchived {
  readonly view: ArchivedView;
  readonly open: boolean;
}

/** Arquivamento que contém o card. */
function archiveEntryOf(params: {
  readonly archive: Board['archive'];
  readonly cardId: string;
}) {
  return params.archive.find((entry) =>
    entry.cards.some(({ card }) => card.id === params.cardId),
  );
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
  | 'data-board-settings'
  | 'data-archive-lane'
  | 'data-board-undo';

/** Nome do quadro, que mora na lista de quadros, para a janela de configuração. */
export interface BoardSettings {
  readonly name: string;
  /** Devolve o nome que vale, ou `null` quando ele está vazio ou repetido. */
  readonly validateName: (name: string) => string | null;
  readonly onRename: (name: string) => void;
}

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
  settings,
  canReset = true,
  author = 'Você',
}: Readonly<{
  initialLanes: readonly BoardLane[];
  initialLabels?: readonly BoardLabel[];
  storageKey?: string;
  /** Com ela, o quadro ganha a janela "Configurar quadro", com nome e prefixo do código. */
  settings?: BoardSettings;
  /** O quadro tem conteúdo de exemplo para restaurar. */
  canReset?: boolean;
  /** Nome de quem comenta nos cards. */
  author?: string;
}>) {
  const { board, canUndo, canRedo, loaded, storageFull, commands } = useBoard({
    initialLanes,
    initialLabels,
    storageKey,
  });
  const { lanes, labels } = board;
  const { keyPrefix } = board.config;
  const shown = visibleLanes(lanes);
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
  const [openArchived, setOpenArchived] = useState<OpenArchived | null>(null);
  const [archiveDrop, setArchiveDrop] = useState(false);
  const { view, setView } = useBoardView(storageKey);
  const [listSort, setListSort] = useState<ListSort>({
    key: 'key',
    direction: 'ascending',
  });
  const [swimlaneDrop, setSwimlaneDrop] = useState<string | null>(null);
  const [dialog, setDialog] = useState<BoardDialog | null>(null);
  const [listDialog, setListDialog] = useState<
    'archive' | 'labels' | 'settings' | null
  >(null);
  /** Muda a cada abertura da configuração, para os campos começarem do valor atual. */
  const [settingsKey, setSettingsKey] = useState(0);
  const dialogCount = useRef(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const instructionsId = useId();

  /** Devolve as colunas da tela, depois de mexidas, ao quadro inteiro, com as ocultas nos lugares delas. */
  const withHidden = (next: readonly BoardLane[]) =>
    mergeVisible({ all: lanes, visible: next });

  const cardKeyboard = useKeyboardMove({
    lanes: shown,
    setLanes: (next) => {
      // WHY: o card levado pelo teclado para uma coluna recolhida precisa da alça na tela para continuar com o foco.
      const receiving = lanesReceiving({
        before: shown,
        after: next,
        collapsed,
      });
      if (receiving.length > 0) {
        collapsedLanes.expand(receiving);
      }
      commands.setLanes(withHidden(next), KEYBOARD_MOVE);
    },
    announce: setAnnouncement,
    keys: CARD_STEP_KEYS,
    step: stepCardById,
    announcementFor: cardMoveAnnouncement,
  });
  const laneKeyboard = useKeyboardMove({
    lanes: shown,
    setLanes: (next) => commands.setLanes(withHidden(next), KEYBOARD_MOVE),
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
    lanes: shown,
    onDragStart: releaseKeyboard,
    onDrop: (drop) => {
      const next = withHidden(drop.lanes);
      const locked = brokenLock({ before: lanes, after: next });
      if (locked) {
        setAnnouncement(`A coluna ${locked.title} está bloqueada.`);
        return;
      }
      commands.setLanes(next);
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
    lanes: shown,
    onDragStart: releaseKeyboard,
    onDrop: (drop) => {
      commands.setLanes(withHidden(drop.lanes));
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
      panelVisible && openLocation
        ? cardKey({ card: openLocation.card, prefix: keyPrefix })
        : undefined,
    onOpen: openDetails,
    onOpenArchived: (cardId) => {
      const entry = archiveEntryOf({ archive: board.archive, cardId });
      if (entry) {
        openArchivedView({ entryId: entry.id, cardId });
      }
    },
    onUnavailable: (text) => setNotice({ color: 'warning', text }),
  });

  function openArchivedView(view: ArchivedView) {
    setOpenArchived({ view, open: true });
  }

  function closeArchivedView() {
    setOpenArchived((current) => current && { ...current, open: false });
  }

  /** O card arrastado pode ir para o arquivo: existe e não está numa coluna bloqueada. */
  function canArchiveDragged(): boolean {
    const cardId = cardDrag.draggedId;
    return Boolean(cardId && !findCard({ lanes, cardId })?.lane.locked);
  }

  const archiveDropHandlers = {
    onDragOver: (event: DragEvent<HTMLElement>) => {
      if (!canArchiveDragged()) {
        return;
      }
      event.preventDefault();
      // WHY: o arraste do card só permite `move`; com outro efeito, o Chromium recusa o drop.
      event.dataTransfer.dropEffect = 'move';
      setArchiveDrop(true);
    },
    onDragLeave: (event: DragEvent<HTMLElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
        setArchiveDrop(false);
      }
    },
    onDrop: (event: DragEvent<HTMLElement>) => {
      setArchiveDrop(false);
      const cardId = cardDrag.draggedId;
      if (!cardId || !canArchiveDragged()) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      cardDrag.onDragEnd();
      const title = findCard({ lanes, cardId })?.card.title;
      commands.archiveCard(cardId);
      setAnnouncement(`Card ${title} arquivado.`);
    },
  };

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
    if (!location || blockedByLock({ cardId })) {
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

  /** Avisa e devolve `true` quando a coluna do card, ou a de destino, está bloqueada. */
  function blockedByLock(change: {
    readonly cardId: string;
    readonly laneId?: string;
  }): boolean {
    const source = findCard({ lanes, cardId: change.cardId })?.lane;
    const target = lanes.find((lane) => lane.id === change.laneId);
    const locked = [source, target].find((lane) => lane?.locked);
    if (locked) {
      setNotice({
        color: 'warning',
        text: `A coluna ${locked.title} está bloqueada: libere a coluna para mudar os cards dela.`,
      });
    }
    return Boolean(locked);
  }

  function archiveFromPanel(cardId: string) {
    const location = findCard({ lanes, cardId });
    if (!location || blockedByLock({ cardId })) {
      return;
    }
    commands.archiveCard(cardId);
    setAnnouncement(`Card ${location.card.title} arquivado.`);
    focusLaneLater(location.lane.id);
  }

  function duplicateFromPanel(cardId: string) {
    if (blockedByLock({ cardId })) {
      return;
    }
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
    const key = cardKey({ card: location.card, prefix: keyPrefix });
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

  /** Restaura o arquivamento; devolve `false`, com aviso, quando ele voltaria para uma coluna bloqueada. */
  function restoreEntry(entryId: string): boolean {
    const locked = brokenLock({
      before: lanes,
      after: restoreArchived({ board, entryId }).lanes,
    });
    if (locked) {
      setNotice({
        color: 'warning',
        text: `A coluna ${locked.title} está bloqueada: libere a coluna para restaurar o card nela.`,
      });
      return false;
    }
    const title = archivedTitle(entryId);
    commands.restoreArchived(entryId);
    setAnnouncement(`Card ${title} restaurado.`);
    return true;
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
    onHide: (laneId) => {
      const lane = lanes.find((candidate) => candidate.id === laneId);
      const index = shown.findIndex((candidate) => candidate.id === laneId);
      commands.setLaneHidden({ laneId, hidden: true });
      setAnnouncement(`Coluna ${lane?.title} oculta.`);
      focusLaneLater((shown[index + 1] ?? shown[index - 1])?.id);
    },
    onToggleLock: (laneId) => {
      const lane = lanes.find((candidate) => candidate.id === laneId);
      commands.setLaneLocked({ laneId, locked: !lane?.locked });
      setAnnouncement(
        `Coluna ${lane?.title} ${lane?.locked ? 'liberada' : 'bloqueada'}.`,
      );
      focusLaneLater(laneId);
    },
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

  const cards = allCards(shown);
  const titles = new Map(cards.map((card) => [card.id, card.title]));
  const counts = childCounts(lanes);
  const progress = childProgress({
    lanes,
    doneLaneId: board.config.doneLaneId,
  });
  const people = new Map(
    (board.config.people ?? []).map((person) => [person.id, person.name]),
  );
  const activeLabels = new Set(
    labels
      .filter((label) => labelFilter.has(label.id))
      .map((label) => label.id),
  );
  const filtering = query.trim() !== '' || activeLabels.size > 0;
  const matches = (card: BoardCard) =>
    cardMatchesQuery({ card, query, labels, keyPrefix }) &&
    cardMatchesLabels({ card, labelIds: activeLabels });
  const lastIndex = shown.length - 1;

  function renderCard(placement: {
    readonly card: BoardCard;
    readonly lane: BoardLane;
    readonly index: number;
    readonly dropBefore: boolean;
  }) {
    const { card, lane, index } = placement;
    return (
      <KanbanCard
        key={card.id}
        card={card}
        keyPrefix={keyPrefix}
        index={index}
        parentTitle={card.parentId ? titles.get(card.parentId) : undefined}
        childCount={counts.get(card.id) ?? 0}
        progress={progress.get(card.id)}
        assignee={card.assigneeId ? people.get(card.assigneeId) : undefined}
        labels={cardLabels({ card, labels })}
        today={today}
        dimmed={filtering && !matches(card)}
        open={panelVisible && openCard?.id === card.id}
        dragging={cardDrag.draggedId === card.id}
        grabbed={cardKeyboard.grabbedId === card.id}
        dropBefore={placement.dropBefore}
        locked={lane.locked}
        instructionsId={instructionsId}
        actions={cardActions}
      />
    );
  }

  /** Solta o card arrastado na célula da linha: vai para o fim da coluna, com o pai da linha. */
  const swimlaneDropHandlers = {
    onDragOver: (event: DragEvent<HTMLElement>, target: CellTarget) => {
      const cardId = cardDrag.draggedId;
      if (!cardId || target.lane.locked) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      setSwimlaneDrop(cellId(target));
    },
    onDragLeave: (event: DragEvent<HTMLElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
        setSwimlaneDrop(null);
      }
    },
    onDrop: (event: DragEvent<HTMLElement>, target: CellTarget) => {
      setSwimlaneDrop(null);
      const cardId = cardDrag.draggedId;
      if (!cardId) {
        return;
      }
      event.preventDefault();
      cardDrag.onDragEnd();
      const location = findCard({ lanes, cardId });
      if (
        !location ||
        location.lane.id === target.lane.id ||
        blockedByLock({ cardId, laneId: target.lane.id })
      ) {
        return;
      }
      commands.moveCardToLane({ cardId, laneId: target.lane.id });
      setAnnouncement(
        `Card ${location.card.title} movido para ${target.lane.title}.`,
      );
    },
  };

  const rows = sortRows({
    rows: listRows({ lanes: shown, people }).filter(
      (row) => !filtering || matches(row.card),
    ),
    sort: listSort,
  });

  function sortBy(key: ListSortKey) {
    setListSort((current) => ({
      key,
      direction:
        current.key === key && current.direction === 'ascending'
          ? 'descending'
          : 'ascending',
    }));
  }

  return (
    <div ref={rootRef} className="kanban-board">
      {storageFull ? (
        <CAlert color="danger" className="py-2">
          O navegador não tem mais espaço para gravar este quadro: as últimas
          mudanças só valem até fechar a página. Remova anexos grandes ou
          arquivados para liberar espaço.
        </CAlert>
      ) : null}
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
        view={{ view, onChange: setView }}
        hiddenLanes={{
          lanes: lanes.filter((lane) => lane.hidden),
          archiveHidden: Boolean(board.config.archiveLaneHidden),
          onShow: (laneId) => {
            commands.setLaneHidden({ laneId, hidden: false });
            focusLaneLater(laneId);
          },
          onShowArchive: () => {
            commands.setArchiveLaneHidden(false);
            requestAnimationFrame(() =>
              focusMarked({ attribute: 'data-archive-lane', id: '' }),
            );
          },
          onShowAll: () => {
            commands.showAllLanes();
            commands.setArchiveLaneHidden(false);
          },
        }}
        archivedCount={board.archive.length}
        onOpenArchive={() => setListDialog('archive')}
        onOpenSettings={
          settings
            ? () => {
                setSettingsKey((key) => key + 1);
                setListDialog('settings');
              }
            : undefined
        }
        onReset={canReset ? () => openDialog({ kind: 'reset' }) : undefined}
      />
      {view.mode === 'list' ? (
        <BoardList
          rows={rows}
          keyPrefix={keyPrefix}
          labels={labels}
          today={today}
          progress={progress}
          sort={listSort}
          onSort={sortBy}
          onOpen={openDetails}
        />
      ) : null}
      {view.mode === 'board' && view.grouped ? (
        <Swimlanes
          groups={groupByParent({ lanes: shown, allLanes: lanes })}
          keyPrefix={keyPrefix}
          progress={progress}
          dropTarget={swimlaneDrop}
          renderCard={(card, lane, index) =>
            renderCard({ card, lane, index, dropBefore: false })
          }
          {...swimlaneDropHandlers}
        />
      ) : null}
      {view.mode === 'board' && !view.grouped ? (
        // biome-ignore lint/a11y/noStaticElementInteractions: só recebe o arraste das colunas, que pode terminar entre duas delas; pelo teclado, a coluna se move pela alça
        <div
          className="kanban-board__lanes d-flex gap-3 overflow-x-auto p-2"
          onDragOver={laneDrag.onDragOver}
          onDragLeave={laneDrag.onDragLeave}
          onDrop={laneDrag.onDrop}
        >
          {shown.map((lane, laneIndex) => {
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
                    laneDrag.visibleSlot === shown.length,
                  cardDropAtEnd: cardDrop?.slot === lane.cards.length,
                  collapsed: collapsed.has(lane.id),
                }}
                canRemove={lanes.length > 1}
                canHide={shown.length > 1}
                instructionsId={instructionsId}
                headerActions={headerActions}
                onDragOver={(event, target) => {
                  // NOTE: sem o `preventDefault`, o navegador não aceita soltar o card na coluna bloqueada.
                  if (!target.locked) {
                    cardDrag.onDragOver(event, target);
                  }
                }}
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
                {lane.cards.map((card, index) =>
                  renderCard({
                    card,
                    lane,
                    index,
                    dropBefore: cardDrop?.slot === index,
                  }),
                )}
              </KanbanLane>
            );
          })}
          {board.config.archiveLaneHidden ? null : (
            <ArchiveLane
              archive={board.archive}
              keyPrefix={keyPrefix}
              dropActive={archiveDrop}
              {...archiveDropHandlers}
              onOpen={openArchivedView}
              onHide={() => {
                commands.setArchiveLaneHidden(true);
                setAnnouncement('Coluna Arquivados oculta.');
                focusMarked({ attribute: 'data-board-archive', id: '' });
              }}
            />
          )}
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
      ) : null}
      <CardDetailsPanel
        visible={panelVisible}
        location={openLocation}
        board={board}
        commands={{
          ...commands,
          moveCardToLane: (change) => {
            if (!blockedByLock(change)) {
              commands.moveCardToLane(change);
            }
          },
        }}
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
        author={author}
        onClose={closeDetails}
      />
      <BoardDialogs dialog={dialog} lanes={lanes} handlers={dialogHandlers} />
      <ArchiveDialog
        visible={listDialog === 'archive'}
        archive={board.archive}
        keyPrefix={keyPrefix}
        onView={(entryId) => {
          const root = board.archive.find((entry) => entry.id === entryId)
            ?.cards[0]?.card;
          if (root) {
            setListDialog(null);
            openArchivedView({ entryId, cardId: root.id });
          }
        }}
        onRestore={(entryId) => {
          restoreEntry(entryId);
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
      <ArchivedCardDialog
        visible={Boolean(openArchived?.open)}
        view={openArchived?.view ?? null}
        board={board}
        onOpenCard={openArchivedView}
        onRestore={(entryId) => {
          if (restoreEntry(entryId)) {
            closeArchivedView();
          }
        }}
        onDelete={(entryId) => {
          const title = archivedTitle(entryId);
          commands.deleteArchived(entryId);
          closeArchivedView();
          setAnnouncement(`Card ${title} excluído de vez.`);
        }}
        onClose={closeArchivedView}
        onClosed={() =>
          focusMarked({ attribute: 'data-board-archive', id: '' })
        }
      />
      {settings && settingsKey > 0 ? (
        <BoardFormDialog
          key={settingsKey}
          visible={listDialog === 'settings'}
          title="Configurar quadro"
          confirmLabel="Salvar"
          initial={{
            name: settings.name,
            keyPrefix,
            doneLaneId: board.config.doneLaneId,
            people: board.config.people,
          }}
          lanes={lanes}
          validateName={settings.validateName}
          prefixHelp="Os links copiados com o prefixo antigo deixam de abrir o card."
          onSave={(values) => {
            settings.onRename(values.name);
            commands.configure({
              keyPrefix: values.keyPrefix,
              doneLaneId: values.doneLaneId ?? null,
              people: values.people,
            });
            setListDialog(null);
            setAnnouncement('Configuração do quadro salva.');
          }}
          onCancel={() => setListDialog(null)}
        >
          <OnClosed
            onClosed={() => {
              if (listDialog !== 'settings') {
                focusMarked({ attribute: 'data-board-settings', id: '' });
              }
            }}
          />
        </BoardFormDialog>
      ) : null}
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
