import type { Board, BoardCard, BoardLabel, CardActivity } from './board';
import { checklistProgress } from './checklist';
import { formatFullDate } from './due';

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

function labelNames(params: {
  readonly ids: readonly string[];
  readonly labels: readonly BoardLabel[];
}): readonly string[] {
  return params.labels
    .filter((label) => params.ids.includes(label.id))
    .map((label) => label.name);
}

function labelChange(params: {
  readonly before: BoardCard;
  readonly after: BoardCard;
  readonly boards: { readonly before: Board; readonly after: Board };
  readonly at: string;
}): CardActivity | undefined {
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

function placeChange(params: {
  readonly before: Placement;
  readonly after: Placement;
  readonly at: string;
}): CardActivity | undefined {
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

/** O que mudou num card que existia antes. */
function changesOf(params: {
  readonly before: Placement;
  readonly after: Placement;
  readonly titles: {
    readonly before: ReadonlyMap<string, Placement>;
    readonly after: ReadonlyMap<string, Placement>;
  };
  readonly boards: { readonly before: Board; readonly after: Board };
  readonly at: string;
}): CardActivity[] {
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
  return changes.filter((change) => change !== undefined);
}

/** Junta dois registros seguidos do mesmo tipo; `null` quando a junção não deixa mudança nenhuma. */
function mergeEntries(
  last: CardActivity,
  next: CardActivity,
): CardActivity | null {
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

/**
 * Acrescenta os registros ao histórico. Com `merge`, um registro do mesmo tipo do último o substitui, guardando o
 * ponto de partida (o título de antes da digitação, a coluna de antes do movimento).
 */
export function appendActivity(params: {
  readonly list: readonly CardActivity[];
  readonly entries: readonly CardActivity[];
  readonly merge: boolean;
}): readonly CardActivity[] {
  const list = [...params.list];
  for (const entry of params.entries) {
    const last = list.at(-1);
    if (params.merge && last?.kind === entry.kind) {
      const merged = mergeEntries(last, entry);
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

/**
 * Registra no histórico de cada card o que mudou de `before` para `after`. Card novo ganha "criado", a menos que já
 * chegue com histórico (a cópia de uma duplicação); card que sumiu de vez não registra nada.
 */
export function withActivity(params: {
  readonly before: Board;
  readonly after: Board;
  readonly at: string;
  readonly merge: boolean;
}): Board {
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

function labelText(entry: Extract<CardActivity, { kind: 'labels' }>): string {
  const parts: string[] = [];
  if (entry.added.length > 0) {
    parts.push(
      `${entry.added.length === 1 ? 'Etiqueta incluída' : 'Etiquetas incluídas'}: ${entry.added.join(', ')}`,
    );
  }
  if (entry.removed.length > 0) {
    parts.push(
      `${entry.removed.length === 1 ? 'Etiqueta removida' : 'Etiquetas removidas'}: ${entry.removed.join(', ')}`,
    );
  }
  return `${parts.join('. ')}.`;
}

function parentText(entry: Extract<CardActivity, { kind: 'parent' }>): string {
  if (entry.from && entry.to) {
    return `Card pai trocado de ${entry.from} para ${entry.to}.`;
  }
  return entry.to
    ? `Ligado ao card pai ${entry.to}.`
    : `Desligado do card pai ${entry.from ?? ''}.`.replace(' .', '.');
}

/** O registro em uma frase, para a lista do painel. */
export function activityText(entry: CardActivity): string {
  switch (entry.kind) {
    case 'created':
      return `Criado em ${entry.lane}.`;
    case 'moved':
      return `Movido de ${entry.from} para ${entry.to}.`;
    case 'renamed':
      return `Título alterado de "${entry.from}" para "${entry.to}".`;
    case 'description':
      return 'Descrição alterada.';
    case 'parent':
      return parentText(entry);
    case 'labels':
      return labelText(entry);
    case 'due':
      return entry.to
        ? `Prazo definido para ${formatFullDate(entry.to)}.`
        : 'Prazo retirado.';
    case 'due-done':
      return entry.done
        ? 'Prazo marcado como cumprido.'
        : 'Prazo marcado como não cumprido.';
    case 'checklist':
      return entry.total === 0
        ? 'Checklist esvaziado.'
        : `Checklist com ${entry.done} de ${entry.total} itens feitos.`;
    case 'archived':
      return 'Arquivado.';
    case 'restored':
      return `Restaurado em ${entry.lane}.`;
    case 'duplicated':
      return `Duplicado de ${entry.from}.`;
  }
}
