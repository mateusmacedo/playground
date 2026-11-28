import { blockerChanges, checklistChange } from './activity-links';
import { processChanges } from './activity-process';
import type { Board, BoardCard, BoardLabel, CardActivity } from './board';
import { personName } from './people';

/** Onde o card está: numa coluna (com o nome dela) ou no arquivo. */
export interface Placement {
  readonly card: BoardCard;
  readonly laneTitle?: string;
}

/** O quadro antes e depois de uma mudança. */
export interface BoardPair {
  readonly before: Board;
  readonly after: Board;
}

/** Onde cada card estava antes e depois da mudança, pelo id. */
export interface PlacementsPair {
  readonly before: ReadonlyMap<string, Placement>;
  readonly after: ReadonlyMap<string, Placement>;
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
  const idsBefore = new Set(before.map((item) => item.id));
  const idsAfter = new Set(after.map((item) => item.id));
  const added = after.find((item) => !idsBefore.has(item.id));
  const removed = before.find((item) => !idsAfter.has(item.id));
  if (!added && !removed) {
    return undefined;
  }
  return { at, kind: 'attachment', added: added?.name, removed: removed?.name };
}

interface TitleOfParams {
  readonly cardId: string | undefined;
  readonly placements: ReadonlyMap<string, Placement>;
}

/** Título do card; `undefined` sem id ou quando o card não está no quadro. */
function titleOf(params: TitleOfParams): string | undefined {
  if (params.cardId === undefined) {
    return undefined;
  }
  return params.placements.get(params.cardId)?.card.title;
}

export interface ChangesOfParams {
  readonly before: Placement;
  readonly after: Placement;
  readonly titles: PlacementsPair;
  readonly boards: BoardPair;
  readonly at: string;
}

/** O que mudou num card que existia antes, na ordem em que entra no histórico. */
export function changesOf(params: ChangesOfParams): readonly CardActivity[] {
  const { at, titles, boards } = params;
  const before = params.before.card;
  const after = params.after.card;
  const changes: CardActivity[] = [];

  const place = placeChange({ before: params.before, after: params.after, at });
  if (place) {
    changes.push(place);
  }
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
      from: titleOf({ cardId: before.parentId, placements: titles.before }),
      to: titleOf({ cardId: after.parentId, placements: titles.after }),
    });
  }
  const labels = labelChange({ before, after, boards, at });
  if (labels) {
    changes.push(labels);
  }
  if (before.dueDate !== after.dueDate) {
    changes.push({ at, kind: 'due', to: after.dueDate });
  } else if (Boolean(before.dueDone) !== Boolean(after.dueDone)) {
    changes.push({ at, kind: 'due-done', done: Boolean(after.dueDone) });
  }
  if (before.checklist !== after.checklist) {
    changes.push(checklistChange({ before, after, titles, at }));
  }
  if (before.assigneeId !== after.assigneeId) {
    const to = personName({ board: boards.after, personId: after.assigneeId });
    changes.push({ at, kind: 'assignee', to });
  }
  const attachment = attachmentChange({ before, after, at });
  if (attachment) {
    changes.push(attachment);
  }
  changes.push(...blockerChanges({ before, after, titles, at }));
  changes.push(...processChanges({ before, after, at }));
  return changes;
}
