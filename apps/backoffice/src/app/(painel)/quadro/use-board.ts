import { useEffect, useRef, useState } from 'react';
import { readStorage, subscribeStorage, writeStorage } from './browser-storage';
import { withActivity } from './model/activity';
import { archiveCard, deleteArchived, restoreArchived } from './model/archive';
import { addAttachment, removeAttachment } from './model/attachments';
import {
  allCards,
  type Board,
  type BoardLabel,
  type BoardLane,
  type BoardPerson,
  type CardAttachment,
} from './model/board';
import { configureBoard } from './model/board-settings';
import { archivedCards, createBoard } from './model/board-state';
import {
  addCard,
  type CardPatch,
  duplicateCard,
  moveCardToLane,
  removeCard,
  updateCard,
} from './model/cards';
import {
  addChecklistItem,
  removeChecklistItem,
  toggleChecklistItem,
} from './model/checklist';
import { addComment, removeComment } from './model/comments';
import { setArchiveLaneHidden } from './model/config';
import { setDueDate, setDueDone } from './model/due';
import { setParent } from './model/hierarchy';
import {
  dropCoalesced,
  type History,
  isCoalescing,
  recordChange,
  redo,
  sealHistory,
  startHistory,
  undo,
} from './model/history';
import { nextId, nextLaneId } from './model/ids';
import {
  createLabel,
  nextLabelId,
  removeLabel,
  toggleCardLabel,
  updateLabel,
} from './model/labels';
import {
  respectsLocks,
  setLaneHidden,
  setLaneLocked,
  showAllLanes,
} from './model/lane-state';
import { addLane, removeLane, renameLane, setWipLimit } from './model/lanes';
import { setAssignee } from './model/people';
import { parseStoredBoard, serializeBoard } from './model/storage';

export interface RenameLaneChange {
  readonly laneId: string;
  readonly title: string;
}

export interface RemoveLaneChange {
  readonly laneId: string;
  readonly moveCardsTo?: string;
}

export interface SetWipLimitChange {
  readonly laneId: string;
  readonly limit: number | undefined;
}

export interface AddCardInput {
  readonly laneId: string;
  readonly title: string;
  readonly parentId?: string;
}

export interface UpdateCardChange {
  readonly cardId: string;
  readonly patch: CardPatch;
}

export interface MoveCardToLaneChange {
  readonly cardId: string;
  readonly laneId: string;
}

export interface SetParentChange {
  readonly cardId: string;
  readonly parentId: string | undefined;
}

export interface ToggleLabelChange {
  readonly cardId: string;
  readonly labelId: string;
}

export interface CreateLabelInput {
  readonly name: string;
  readonly color: BoardLabel['color'];
  readonly cardId?: string;
}

export interface UpdateLabelChange {
  readonly labelId: string;
  readonly patch: Partial<Pick<BoardLabel, 'name' | 'color'>>;
}

export interface SetDueDateChange {
  readonly cardId: string;
  readonly dueDate: string | undefined;
}

export interface SetDueDoneChange {
  readonly cardId: string;
  readonly done: boolean;
}

export interface AddChecklistItemChange {
  readonly cardId: string;
  readonly text: string;
}

export interface ToggleChecklistItemChange {
  readonly cardId: string;
  readonly itemId: string;
}

export interface RemoveChecklistItemChange {
  readonly cardId: string;
  readonly itemId: string;
}

export interface SetLaneHiddenChange {
  readonly laneId: string;
  readonly hidden: boolean;
}

export interface SetLaneLockedChange {
  readonly laneId: string;
  readonly locked: boolean;
}

export interface SetAssigneeChange {
  readonly cardId: string;
  readonly assigneeId: string | undefined;
}

export interface AddCommentChange {
  readonly cardId: string;
  readonly author: string;
  readonly text: string;
}

export interface RemoveCommentChange {
  readonly cardId: string;
  readonly commentId: string;
}

export interface AddAttachmentChange {
  readonly cardId: string;
  readonly attachment: Omit<CardAttachment, 'id' | 'at'>;
}

export interface RemoveAttachmentChange {
  readonly cardId: string;
  readonly attachmentId: string;
}

export interface ConfigureSettings {
  readonly keyPrefix?: string;
  readonly doneLaneId?: string | null;
  readonly people?: readonly BoardPerson[];
}

/** O que as telas do quadro pedem; cada comando vira um passo do desfazer e um registro no histórico do card. */
export interface BoardCommands {
  /** Troca as colunas (arraste e teclado); com `key`, registros seguidos com a mesma chave são um passo só. */
  readonly setLanes: (lanes: readonly BoardLane[], key?: string) => void;
  /** Fecha o passo atual: o próximo registro vira um passo novo. */
  readonly seal: () => void;
  readonly undo: () => void;
  readonly redo: () => void;
  /** Devolve o id da coluna criada, ou `undefined` quando o nome veio vazio. */
  readonly addLane: (title: string) => string | undefined;
  readonly renameLane: (change: RenameLaneChange) => void;
  readonly removeLane: (change: RemoveLaneChange) => void;
  readonly setWipLimit: (change: SetWipLimitChange) => void;
  /** Devolve o id do card criado, ou `undefined` quando o título veio vazio. */
  readonly addCard: (card: AddCardInput) => string | undefined;
  readonly updateCard: (change: UpdateCardChange) => void;
  readonly moveCardToLane: (change: MoveCardToLaneChange) => void;
  readonly setParent: (change: SetParentChange) => void;
  readonly removeCard: (cardId: string) => void;
  readonly archiveCard: (cardId: string) => void;
  readonly restoreArchived: (entryId: string) => void;
  readonly deleteArchived: (entryId: string) => void;
  /** Devolve o id da cópia. */
  readonly duplicateCard: (cardId: string) => string | undefined;
  readonly toggleLabel: (change: ToggleLabelChange) => void;
  /** Devolve o id da etiqueta criada, ou `undefined` quando o nome veio vazio ou repetido. */
  readonly createLabel: (label: CreateLabelInput) => string | undefined;
  readonly updateLabel: (change: UpdateLabelChange) => void;
  readonly removeLabel: (labelId: string) => void;
  readonly setDueDate: (change: SetDueDateChange) => void;
  readonly setDueDone: (change: SetDueDoneChange) => void;
  readonly addChecklistItem: (change: AddChecklistItemChange) => void;
  readonly toggleChecklistItem: (change: ToggleChecklistItemChange) => void;
  readonly removeChecklistItem: (change: RemoveChecklistItemChange) => void;
  /** Oculta ou mostra a coluna; a última visível não sai da tela. */
  readonly setLaneHidden: (change: SetLaneHiddenChange) => void;
  readonly showAllLanes: () => void;
  readonly setLaneLocked: (change: SetLaneLockedChange) => void;
  readonly setArchiveLaneHidden: (hidden: boolean) => void;
  readonly setAssignee: (change: SetAssigneeChange) => void;
  readonly addComment: (change: AddCommentChange) => void;
  readonly removeComment: (change: RemoveCommentChange) => void;
  readonly addAttachment: (change: AddAttachmentChange) => void;
  readonly removeAttachment: (change: RemoveAttachmentChange) => void;
  /**
   * Aplica a configuração do quadro num passo só: prefixo do código (inválido não muda), coluna de conclusão (`null`
   * tira) e pessoas (quem sai deixa de ser responsável pelos cards).
   */
  readonly configure: (settings: ConfigureSettings) => void;
  /** Volta às colunas e aos cards iniciais, mantendo a configuração. */
  readonly reset: () => void;
}

export interface BoardState {
  readonly board: Board;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  /** O quadro gravado já foi lido (ou não há o que ler). */
  readonly loaded: boolean;
  /** A última gravação falhou, quase sempre por falta de espaço no navegador. */
  readonly storageFull: boolean;
  readonly commands: BoardCommands;
}

/** Mudança pedida ao quadro, que vira um passo do desfazer. */
interface BoardChange {
  readonly update: (current: Board) => Board;
  /** Mudanças seguidas com a mesma chave entram no mesmo passo. */
  readonly key?: string;
  /** Registra a mudança no histórico dos cards; ligado quando ausente. */
  readonly log?: boolean;
}

/** Mesmas colunas, uma a uma: a lista pode ter sido remontada sem mudar nenhuma delas. */
function sameLanes(a: readonly BoardLane[], b: readonly BoardLane[]): boolean {
  return a.length === b.length && a.every((lane, index) => lane === b[index]);
}

/** Mesmo conteúdo, sem contar o histórico dos cards. */
function sameContent(a: Board, b: Board): boolean {
  return (
    sameLanes(a.lanes, b.lanes) &&
    a.archive === b.archive &&
    a.labels === b.labels &&
    a.nextNumber === b.nextNumber &&
    a.config === b.config
  );
}

interface WithChangeParams {
  readonly history: History<Board>;
  readonly next: Board;
  readonly key?: string;
  readonly log: boolean;
}

function withChange(params: WithChangeParams): History<Board> {
  const { history, next, key, log } = params;
  if (
    next === history.present ||
    sameContent(next, history.present) ||
    // NOTE: a coluna bloqueada barra qualquer comando que mude os cards dela, venha de onde vier.
    !respectsLocks({ before: history.present.lanes, after: next.lanes })
  ) {
    return history;
  }
  const coalescing = isCoalescing({ history, key });
  const top = history.past.at(-1);
  // NOTE: um passo agrupado que volta ao começo (o Esc de um movimento pelo teclado) some do desfazer.
  if (coalescing && top && sameContent(next, top)) {
    return dropCoalesced(history);
  }
  const logged = log
    ? withActivity({
        before: history.present,
        after: next,
        at: new Date().toISOString(),
        merge: coalescing,
      })
    : next;
  return recordChange({ history, next: logged, key });
}

function editKey(change: UpdateCardChange): string | undefined {
  if (change.patch.title !== undefined) {
    return `title:${change.cardId}`;
  }
  return change.patch.description === undefined
    ? undefined
    : `description:${change.cardId}`;
}

export interface UseBoardParams {
  readonly initialLanes: readonly BoardLane[];
  readonly initialLabels?: readonly BoardLabel[];
  readonly storageKey?: string;
}

/**
 * Estado do quadro com desfazer e refazer, os comandos de edição e, com `storageKey`, a gravação no navegador. O
 * servidor e a primeira renderização usam o quadro inicial; depois de montar, o quadro gravado e válido o substitui.
 * O que outra aba grava na mesma chave substitui o quadro desta aba e recomeça o desfazer.
 */
export function useBoard(params: UseBoardParams): BoardState {
  const { initialLanes, initialLabels, storageKey } = params;
  const initial = () =>
    createBoard({ lanes: initialLanes, labels: initialLabels });
  const [history, setHistory] = useState(() => startHistory(initial()));
  const [loaded, setLoaded] = useState(!storageKey);
  const [storageFull, setStorageFull] = useState(false);
  /** Último quadro lido do armazenamento, que não precisa ser gravado de volta. */
  const fromStorage = useRef<Board | null>(null);
  const board = history.present;

  useEffect(() => {
    if (!storageKey) {
      return;
    }
    const receive = (raw: string | null) => {
      const stored = parseStoredBoard(raw);
      if (stored) {
        fromStorage.current = stored;
        // WHY: desfazer depois da mudança de outra aba gravaria por cima dela um quadro que ela já não tem.
        setHistory(startHistory(stored));
      }
    };
    receive(readStorage(storageKey));
    setLoaded(true);
    return subscribeStorage({ key: storageKey, onChange: receive });
  }, [storageKey]);

  useEffect(() => {
    // NOTE: regravar o que veio de outra aba devolveria a ela, com outra ordem de campos, uma mudança que não houve.
    if (storageKey && loaded && board !== fromStorage.current) {
      setStorageFull(
        !writeStorage({ key: storageKey, value: serializeBoard(board) }),
      );
    }
  }, [storageKey, loaded, board]);

  function commit(change: BoardChange) {
    setHistory((current) =>
      withChange({
        history: current,
        next: change.update(current.present),
        key: change.key,
        log: change.log ?? true,
      }),
    );
  }

  const onLanes =
    (update: (lanes: readonly BoardLane[]) => readonly BoardLane[]) =>
    (current: Board): Board => {
      const lanes = update(current.lanes);
      return lanes === current.lanes ? current : { ...current, lanes };
    };

  const takenCardIds = () =>
    [...allCards(board.lanes), ...archivedCards(board)].map((card) => card.id);

  const commands: BoardCommands = {
    setLanes: (lanes, key) =>
      commit({ update: (current) => ({ ...current, lanes }), key }),
    seal: () => setHistory(sealHistory),
    undo: () => setHistory(undo),
    redo: () => setHistory(redo),
    addLane: (title) => {
      const id = nextLaneId(board.lanes);
      if (!title.trim()) {
        return undefined;
      }
      commit({
        update: onLanes((lanes) => addLane({ lanes, lane: { id, title } })),
      });
      return id;
    },
    renameLane: (change) =>
      commit({ update: onLanes((lanes) => renameLane({ lanes, ...change })) }),
    removeLane: (change) =>
      commit({ update: onLanes((lanes) => removeLane({ lanes, ...change })) }),
    setWipLimit: (change) =>
      commit({ update: onLanes((lanes) => setWipLimit({ lanes, ...change })) }),
    addCard: ({ laneId, title, parentId }) => {
      const id = nextId({ prefix: 'card', taken: takenCardIds() });
      if (!title.trim()) {
        return undefined;
      }
      commit({
        update: (current) => {
          const lanes = addCard({
            lanes: current.lanes,
            laneId,
            card: { id, title, parentId, number: current.nextNumber },
          });
          return lanes === current.lanes
            ? current
            : { ...current, lanes, nextNumber: current.nextNumber + 1 };
        },
      });
      return id;
    },
    updateCard: (change) =>
      commit({
        update: onLanes((lanes) => updateCard({ lanes, ...change })),
        key: editKey(change),
      }),
    moveCardToLane: (change) =>
      commit({
        update: onLanes((lanes) => moveCardToLane({ lanes, ...change })),
      }),
    setParent: (change) =>
      commit({ update: onLanes((lanes) => setParent({ lanes, ...change })) }),
    removeCard: (cardId) =>
      commit({ update: onLanes((lanes) => removeCard({ lanes, cardId })) }),
    archiveCard: (cardId) =>
      commit({
        update: (current) =>
          archiveCard({
            board: current,
            cardId,
            at: new Date().toISOString(),
          }),
      }),
    restoreArchived: (entryId) =>
      commit({
        update: (current) => restoreArchived({ board: current, entryId }),
      }),
    deleteArchived: (entryId) =>
      commit({
        update: (current) => deleteArchived({ board: current, entryId }),
      }),
    duplicateCard: (cardId) => {
      const newId = nextId({ prefix: 'card', taken: takenCardIds() });
      commit({
        update: (current) =>
          duplicateCard({
            board: current,
            cardId,
            newId,
            at: new Date().toISOString(),
          }),
      });
      return newId;
    },
    toggleLabel: (change) =>
      commit({
        update: onLanes((lanes) => toggleCardLabel({ lanes, ...change })),
      }),
    createLabel: ({ name, color, cardId }) => {
      const id = nextLabelId(board.labels);
      const next = createLabel({ board, label: { id, name, color }, cardId });
      if (next === board) {
        return undefined;
      }
      commit({
        update: (current) =>
          createLabel({ board: current, label: { id, name, color }, cardId }),
      });
      return id;
    },
    updateLabel: (change) =>
      commit({
        update: (current) => updateLabel({ board: current, ...change }),
        key:
          change.patch.name === undefined
            ? undefined
            : `label:${change.labelId}`,
      }),
    removeLabel: (labelId) =>
      commit({ update: (current) => removeLabel({ board: current, labelId }) }),
    setDueDate: (change) =>
      commit({ update: onLanes((lanes) => setDueDate({ lanes, ...change })) }),
    setDueDone: (change) =>
      commit({ update: onLanes((lanes) => setDueDone({ lanes, ...change })) }),
    addChecklistItem: (change) =>
      commit({
        update: onLanes((lanes) => addChecklistItem({ lanes, ...change })),
      }),
    toggleChecklistItem: (change) =>
      commit({
        update: onLanes((lanes) => toggleChecklistItem({ lanes, ...change })),
      }),
    removeChecklistItem: (change) =>
      commit({
        update: onLanes((lanes) => removeChecklistItem({ lanes, ...change })),
      }),
    setLaneHidden: (change) =>
      commit({
        update: onLanes((lanes) => setLaneHidden({ lanes, ...change })),
      }),
    showAllLanes: () => commit({ update: onLanes(showAllLanes) }),
    setLaneLocked: (change) =>
      commit({
        update: onLanes((lanes) => setLaneLocked({ lanes, ...change })),
      }),
    setArchiveLaneHidden: (hidden) =>
      commit({
        update: (current) => {
          const config = setArchiveLaneHidden({
            config: current.config,
            hidden,
          });
          return config === current.config ? current : { ...current, config };
        },
      }),
    setAssignee: (change) =>
      commit({
        update: (current) => setAssignee({ board: current, ...change }),
      }),
    addComment: ({ cardId, author, text }) =>
      commit({
        update: onLanes((lanes) =>
          addComment({
            lanes,
            cardId,
            comment: { author, text, at: new Date().toISOString() },
          }),
        ),
      }),
    removeComment: (change) =>
      commit({
        update: onLanes((lanes) => removeComment({ lanes, ...change })),
      }),
    addAttachment: ({ cardId, attachment }) =>
      commit({
        update: onLanes((lanes) =>
          addAttachment({
            lanes,
            cardId,
            attachment: { ...attachment, at: new Date().toISOString() },
          }),
        ),
      }),
    removeAttachment: (change) =>
      commit({
        update: onLanes((lanes) => removeAttachment({ lanes, ...change })),
      }),
    configure: (settings) =>
      commit({
        update: (current) => configureBoard({ board: current, ...settings }),
      }),
    reset: () =>
      commit({
        update: (current) =>
          createBoard({
            lanes: initialLanes,
            labels: initialLabels,
            config: current.config,
          }),
        log: false,
      }),
  };

  return {
    board,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    loaded,
    storageFull,
    commands,
  };
}
