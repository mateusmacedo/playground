import type { Board, BoardCard, BoardLabel, CardActivity } from './board';
import { checklistProgress } from './checklist';

/** Quantos registros o histórico de um card guarda; os mais antigos saem primeiro. */
export const ACTIVITY_LIMIT = 50;

/** Onde o card está: numa coluna (com o nome dela) ou no arquivo. */
interface Placement {
  readonly card: BoardCard;
  readonly laneTitle?: string;
}

function placements(board: Board): ReadonlyMap<string, Placement> {
  const map = new Map<string, Placement>();
  for (const lane of board.lanes) {
    for (const card of lane.cards) {
      map.set(card.id, { card, laneTitle: lane.title });
    }
  }
  for (const entry of board.archive) {
    for (const { card } of entry.cards) {
      map.set(card.id, { card });
    }
  }
  return map;
}

interface LabelNamesParams {
  readonly ids: readonly string[];
  readonly labels: readonly BoardLabel[];
}

function labelNames(params: LabelNamesParams): readonly string[] {
  return params.labels
    .filter((label) => params.ids.includes(label.id))
    .map((label) => label.name);
}

/** O quadro antes e depois de uma mudança. */
interface BoardPair {
  readonly before: Board;
  readonly after: Board;
}

/** Onde cada card estava antes e depois da mudança, pelo id. */
interface PlacementsPair {
  readonly before: ReadonlyMap<string, Placement>;
  readonly after: ReadonlyMap<string, Placement>;
}

interface LabelChangeParams {
  readonly before: BoardCard;
  readonly after: BoardCard;
  readonly boards: BoardPair;
  readonly at: string;
}

function labelChange(params: LabelChangeParams): CardActivity | undefined {
  const old = params.before.labelIds ?? [];
  const current = params.after.labelIds ?? [];
  const added = current.filter((id) => !old.includes(id));
  const removed = old.filter((id) => !current.includes(id));
  if (added.length === 0 && removed.length === 0) {
    return undefined;
  }
  return {
    at: params.at,
    kind: 'labels',
    added: labelNames({ ids: added, labels: params.boards.after.labels }),
    removed: labelNames({ ids: removed, labels: params.boards.before.labels }),
  };
}

interface PlaceChangeParams {
  readonly before: Placement;
  readonly after: Placement;
  readonly at: string;
}

function placeChange(params: PlaceChangeParams): CardActivity | undefined {
  const { before, after, at } = params;
  if (before.laneTitle === after.laneTitle) {
    return undefined;
  }
  if (after.laneTitle === undefined) {
    return { at, kind: 'archived' };
  }
  if (before.laneTitle === undefined) {
    return { at, kind: 'restored', lane: after.laneTitle };
  }
  return { at, kind: 'moved', from: before.laneTitle, to: after.laneTitle };
}

interface AttachmentChangeParams {
  readonly before: BoardCard;
  readonly after: BoardCard;
  readonly at: string;
}

/** Anexo que entrou ou saiu do card; um por vez, como a tela faz. */
function attachmentChange(
  params: AttachmentChangeParams,
): CardActivity | undefined {
  const { at } = params;
  const before = params.before.attachments ?? [];
  const after = params.after.attachments ?? [];
  if (before === after) {
    return undefined;
  }
  const added = after.find((item) => !before.some((old) => old.id === item.id));
  const removed = before.find(
    (item) => !after.some((current) => current.id === item.id),
  );
  if (!added && !removed) {
    return undefined;
  }
  return { at, kind: 'attachment', added: added?.name, removed: removed?.name };
}

interface ChangesOfParams {
  readonly before: Placement;
  readonly after: Placement;
  readonly titles: PlacementsPair;
  readonly boards: BoardPair;
  readonly at: string;
}

/** O que mudou num card que existia antes. */
function changesOf(params: ChangesOfParams): CardActivity[] {
  const { at, titles, boards } = params;
  const before = params.before.card;
  const after = params.after.card;
  const changes: (CardActivity | undefined)[] = [
    placeChange({ before: params.before, after: params.after, at }),
  ];
  if (before.title !== after.title) {
    changes.push({ at, kind: 'renamed', from: before.title, to: after.title });
  }
  if ((before.description ?? '') !== (after.description ?? '')) {
    changes.push({ at, kind: 'description' });
  }
  if (before.parentId !== after.parentId) {
    changes.push({
      at,
      kind: 'parent',
      from: before.parentId && titles.before.get(before.parentId)?.card.title,
      to: after.parentId && titles.after.get(after.parentId)?.card.title,
    });
  }
  changes.push(labelChange({ before, after, boards, at }));
  if (before.dueDate !== after.dueDate) {
    changes.push({ at, kind: 'due', to: after.dueDate });
  } else if (Boolean(before.dueDone) !== Boolean(after.dueDone)) {
    changes.push({ at, kind: 'due-done', done: Boolean(after.dueDone) });
  }
  if (before.checklist !== after.checklist) {
    changes.push({ at, kind: 'checklist', ...checklistProgress(after) });
  }
  if (before.assigneeId !== after.assigneeId) {
    changes.push({
      at,
      kind: 'assignee',
      to: boards.after.config.people?.find(
        (person) => person.id === after.assigneeId,
      )?.name,
    });
  }
  changes.push(attachmentChange({ before, after, at }));
  return changes.filter((change) => change !== undefined);
}

/** Dois registros seguidos do histórico: o último gravado e o que chega. */
interface EntryPair {
  readonly last: CardActivity;
  readonly next: CardActivity;
}

/** Junta dois registros seguidos do mesmo tipo; `null` quando a junção não deixa mudança nenhuma. */
function mergeEntries(params: EntryPair): CardActivity | null {
  const { last, next } = params;
  if (
    (last.kind === 'moved' && next.kind === 'moved') ||
    (last.kind === 'renamed' && next.kind === 'renamed')
  ) {
    return last.from === next.to ? null : { ...next, from: last.from };
  }
  if (last.kind === 'parent' && next.kind === 'parent') {
    return last.from === next.to ? null : { ...next, from: last.from };
  }
  return next;
}

export interface AppendActivityParams {
  readonly list: readonly CardActivity[];
  readonly entries: readonly CardActivity[];
  readonly merge: boolean;
}

/**
 * Acrescenta os registros ao histórico. Com `merge`, um registro do mesmo tipo do último o substitui, guardando o
 * ponto de partida (o título de antes da digitação, a coluna de antes do movimento).
 */
export function appendActivity(
  params: AppendActivityParams,
): readonly CardActivity[] {
  const list = [...params.list];
  for (const entry of params.entries) {
    const last = list.at(-1);
    if (params.merge && last?.kind === entry.kind) {
      const merged = mergeEntries({ last, next: entry });
      list.pop();
      if (merged) {
        list.push(merged);
      }
    } else {
      list.push(entry);
    }
  }
  return list.slice(-ACTIVITY_LIMIT);
}

export interface WithActivityParams {
  readonly before: Board;
  readonly after: Board;
  readonly at: string;
  readonly merge: boolean;
}

/**
 * Registra no histórico de cada card o que mudou de `before` para `after`. Card novo ganha "criado", a menos que já
 * chegue com histórico (a cópia de uma duplicação); card que sumiu de vez não registra nada.
 */
export function withActivity(params: WithActivityParams): Board {
  const { before, after, at, merge } = params;
  if (before === after) {
    return after;
  }
  const titles = { before: placements(before), after: placements(after) };
  const updated = new Map<string, BoardCard>();
  for (const [id, current] of titles.after) {
    const previous = titles.before.get(id);
    let entries: readonly CardActivity[];
    if (previous) {
      entries =
        previous.card === current.card &&
        previous.laneTitle === current.laneTitle
          ? []
          : changesOf({
              before: previous,
              after: current,
              titles,
              boards: { before, after },
              at,
            });
    } else {
      entries =
        current.card.activity?.length || current.laneTitle === undefined
          ? []
          : [{ at, kind: 'created', lane: current.laneTitle }];
    }
    if (entries.length > 0) {
      const activity = appendActivity({
        list: current.card.activity ?? [],
        entries,
        merge,
      });
      updated.set(id, {
        ...current.card,
        activity: activity.length > 0 ? activity : undefined,
      });
    }
  }
  if (updated.size === 0) {
    return after;
  }
  const replace = (card: BoardCard) => updated.get(card.id) ?? card;
  const archiveChanged = after.archive.some((entry) =>
    entry.cards.some(({ card }) => updated.has(card.id)),
  );
  return {
    ...after,
    lanes: after.lanes.map((lane) =>
      lane.cards.some((card) => updated.has(card.id))
        ? { ...lane, cards: lane.cards.map(replace) }
        : lane,
    ),
    // NOTE: sem card arquivado mudando, o arquivo continua o mesmo objeto; o desfazer compara por referência.
    archive: !archiveChanged
      ? after.archive
      : after.archive.map((entry) =>
          entry.cards.some(({ card }) => updated.has(card.id))
            ? {
                ...entry,
                cards: entry.cards.map((item) => ({
                  ...item,
                  card: replace(item.card),
                })),
              }
            : entry,
        ),
  };
}
