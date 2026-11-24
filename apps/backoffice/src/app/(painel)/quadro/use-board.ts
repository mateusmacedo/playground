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
  readonly renameLane: (change: {
    readonly laneId: string;
    readonly title: string;
  }) => void;
  readonly removeLane: (change: {
    readonly laneId: string;
    readonly moveCardsTo?: string;
  }) => void;
  readonly setWipLimit: (change: {
    readonly laneId: string;
    readonly limit: number | undefined;
  }) => void;
  /** Devolve o id do card criado, ou `undefined` quando o título veio vazio. */
  readonly addCard: (card: {
    readonly laneId: string;
    readonly title: string;
    readonly parentId?: string;
  }) => string | undefined;
  readonly updateCard: (change: {
    readonly cardId: string;
    readonly patch: CardPatch;
  }) => void;
  readonly moveCardToLane: (change: {
    readonly cardId: string;
    readonly laneId: string;
  }) => void;
  readonly setParent: (change: {
    readonly cardId: string;
    readonly parentId: string | undefined;
  }) => void;
  readonly removeCard: (cardId: string) => void;
  readonly archiveCard: (cardId: string) => void;
  readonly restoreArchived: (entryId: string) => void;
  readonly deleteArchived: (entryId: string) => void;
  /** Devolve o id da cópia. */
  readonly duplicateCard: (cardId: string) => string | undefined;
  readonly toggleLabel: (change: {
    readonly cardId: string;
    readonly labelId: string;
  }) => void;
  /** Devolve o id da etiqueta criada, ou `undefined` quando o nome veio vazio ou repetido. */
  readonly createLabel: (label: {
    readonly name: string;
    readonly color: BoardLabel['color'];
    readonly cardId?: string;
  }) => string | undefined;
  readonly updateLabel: (change: {
    readonly labelId: string;
    readonly patch: Partial<Pick<BoardLabel, 'name' | 'color'>>;
  }) => void;
  readonly removeLabel: (labelId: string) => void;
  readonly setDueDate: (change: {
    readonly cardId: string;
    readonly dueDate: string | undefined;
  }) => void;
  readonly setDueDone: (change: {
    readonly cardId: string;
    readonly done: boolean;
  }) => void;
  readonly addChecklistItem: (change: {
    readonly cardId: string;
    readonly text: string;
  }) => void;
  readonly toggleChecklistItem: (change: {
    readonly cardId: string;
    readonly itemId: string;
  }) => void;
  readonly removeChecklistItem: (change: {
    readonly cardId: string;
    readonly itemId: string;
  }) => void;
  /** Oculta ou mostra a coluna; a última visível não sai da tela. */
  readonly setLaneHidden: (change: {
    readonly laneId: string;
    readonly hidden: boolean;
  }) => void;
  readonly showAllLanes: () => void;
  readonly setLaneLocked: (change: {
    readonly laneId: string;
    readonly locked: boolean;
  }) => void;
  readonly setArchiveLaneHidden: (hidden: boolean) => void;
  readonly setAssignee: (change: {
    readonly cardId: string;
    readonly assigneeId: string | undefined;
  }) => void;
  readonly addComment: (change: {
    readonly cardId: string;
    readonly author: string;
    readonly text: string;
  }) => void;
  readonly removeComment: (change: {
    readonly cardId: string;
    readonly commentId: string;
  }) => void;
  readonly addAttachment: (change: {
    readonly cardId: string;
    readonly attachment: Omit<CardAttachment, 'id' | 'at'>;
  }) => void;
  readonly removeAttachment: (change: {
    readonly cardId: string;
    readonly attachmentId: string;
  }) => void;
  /**
   * Aplica a configuração do quadro num passo só: prefixo do código (inválido não muda), coluna de conclusão (`null`
   * tira) e pessoas (quem sai deixa de ser responsável pelos cards).
   */
  readonly configure: (settings: {
    readonly keyPrefix?: string;
    readonly doneLaneId?: string | null;
    readonly people?: readonly BoardPerson[];
  }) => void;
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

function withChange(params: {
  readonly history: History<Board>;
  readonly next: Board;
  readonly key?: string;
  readonly log: boolean;
}): History<Board> {
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

function editKey(change: {
  readonly cardId: string;
  readonly patch: CardPatch;
}): string | undefined {
  if (change.patch.title !== undefined) {
    return `title:${change.cardId}`;
  }
  return change.patch.description === undefined
    ? undefined
    : `description:${change.cardId}`;
}

/**
 * Estado do quadro com desfazer e refazer, os comandos de edição e, com `storageKey`, a gravação no navegador. O
 * servidor e a primeira renderização usam o quadro inicial; depois de montar, o quadro gravado e válido o substitui.
 * O que outra aba grava na mesma chave substitui o quadro desta aba e recomeça o desfazer.
 */
export function useBoard(params: {
  readonly initialLanes: readonly BoardLane[];
  readonly initialLabels?: readonly BoardLabel[];
  readonly storageKey?: string;
}): BoardState {
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

  function commit(
    update: (current: Board) => Board,
    options: { readonly key?: string; readonly log?: boolean } = {},
  ) {
    setHistory((current) =>
      withChange({
        history: current,
        next: update(current.present),
        key: options.key,
        log: options.log ?? true,
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
      commit((current) => ({ ...current, lanes }), { key }),
    seal: () => setHistory(sealHistory),
    undo: () => setHistory(undo),
    redo: () => setHistory(redo),
    addLane: (title) => {
      const id = nextLaneId(board.lanes);
      if (!title.trim()) {
        return undefined;
      }
      commit(onLanes((lanes) => addLane({ lanes, lane: { id, title } })));
      return id;
    },
    renameLane: (change) =>
      commit(onLanes((lanes) => renameLane({ lanes, ...change }))),
    removeLane: (change) =>
      commit(onLanes((lanes) => removeLane({ lanes, ...change }))),
    setWipLimit: (change) =>
      commit(onLanes((lanes) => setWipLimit({ lanes, ...change }))),
    addCard: ({ laneId, title, parentId }) => {
      const id = nextId({ prefix: 'card', taken: takenCardIds() });
      if (!title.trim()) {
        return undefined;
      }
      commit((current) => {
        const lanes = addCard({
          lanes: current.lanes,
          laneId,
          card: { id, title, parentId, number: current.nextNumber },
        });
        return lanes === current.lanes
          ? current
          : { ...current, lanes, nextNumber: current.nextNumber + 1 };
      });
      return id;
    },
    updateCard: (change) =>
      commit(
        onLanes((lanes) => updateCard({ lanes, ...change })),
        {
          key: editKey(change),
        },
      ),
    moveCardToLane: (change) =>
      commit(onLanes((lanes) => moveCardToLane({ lanes, ...change }))),
    setParent: (change) =>
      commit(onLanes((lanes) => setParent({ lanes, ...change }))),
    removeCard: (cardId) =>
      commit(onLanes((lanes) => removeCard({ lanes, cardId }))),
    archiveCard: (cardId) =>
      commit((current) =>
        archiveCard({
          board: current,
          cardId,
          at: new Date().toISOString(),
        }),
      ),
    restoreArchived: (entryId) =>
      commit((current) => restoreArchived({ board: current, entryId })),
    deleteArchived: (entryId) =>
      commit((current) => deleteArchived({ board: current, entryId })),
    duplicateCard: (cardId) => {
      const newId = nextId({ prefix: 'card', taken: takenCardIds() });
      commit((current) =>
        duplicateCard({
          board: current,
          cardId,
          newId,
          at: new Date().toISOString(),
        }),
      );
      return newId;
    },
    toggleLabel: (change) =>
      commit(onLanes((lanes) => toggleCardLabel({ lanes, ...change }))),
    createLabel: ({ name, color, cardId }) => {
      const id = nextLabelId(board.labels);
      const next = createLabel({ board, label: { id, name, color }, cardId });
      if (next === board) {
        return undefined;
      }
      commit((current) =>
        createLabel({ board: current, label: { id, name, color }, cardId }),
      );
      return id;
    },
    updateLabel: (change) =>
      commit((current) => updateLabel({ board: current, ...change }), {
        key:
          change.patch.name === undefined
            ? undefined
            : `label:${change.labelId}`,
      }),
    removeLabel: (labelId) =>
      commit((current) => removeLabel({ board: current, labelId })),
    setDueDate: (change) =>
      commit(onLanes((lanes) => setDueDate({ lanes, ...change }))),
    setDueDone: (change) =>
      commit(onLanes((lanes) => setDueDone({ lanes, ...change }))),
    addChecklistItem: (change) =>
      commit(onLanes((lanes) => addChecklistItem({ lanes, ...change }))),
    toggleChecklistItem: (change) =>
      commit(onLanes((lanes) => toggleChecklistItem({ lanes, ...change }))),
    removeChecklistItem: (change) =>
      commit(onLanes((lanes) => removeChecklistItem({ lanes, ...change }))),
    setLaneHidden: (change) =>
      commit(onLanes((lanes) => setLaneHidden({ lanes, ...change }))),
    showAllLanes: () => commit(onLanes(showAllLanes)),
    setLaneLocked: (change) =>
      commit(onLanes((lanes) => setLaneLocked({ lanes, ...change }))),
    setArchiveLaneHidden: (hidden) =>
      commit((current) => {
        const config = setArchiveLaneHidden({ config: current.config, hidden });
        return config === current.config ? current : { ...current, config };
      }),
    setAssignee: (change) =>
      commit((current) => setAssignee({ board: current, ...change })),
    addComment: ({ cardId, author, text }) =>
      commit(
        onLanes((lanes) =>
          addComment({
            lanes,
            cardId,
            comment: { author, text, at: new Date().toISOString() },
          }),
        ),
      ),
    removeComment: (change) =>
      commit(onLanes((lanes) => removeComment({ lanes, ...change }))),
    addAttachment: ({ cardId, attachment }) =>
      commit(
        onLanes((lanes) =>
          addAttachment({
            lanes,
            cardId,
            attachment: { ...attachment, at: new Date().toISOString() },
          }),
        ),
      ),
    removeAttachment: (change) =>
      commit(onLanes((lanes) => removeAttachment({ lanes, ...change }))),
    configure: (settings) =>
      commit((current) => configureBoard({ board: current, ...settings })),
    reset: () =>
      commit(
        (current) =>
          createBoard({
            lanes: initialLanes,
            labels: initialLabels,
            config: current.config,
          }),
        { log: false },
      ),
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
