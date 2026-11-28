import {
  type CardPlacement,
  KanbanCard,
  type KanbanCardActions,
  type RenderCard,
} from './kanban-card';
import type { BoardLabel } from './model/board';
import type { CardLookups } from './model/card-lookups';
import { cardLabels } from './model/labels';
import type { BoardFilter } from './use-board-filter';

export interface CardRendererParams {
  readonly lookups: CardLookups;
  readonly labels: readonly BoardLabel[];
  /** Prefixo do código dos cards do quadro. */
  readonly keyPrefix: string;
  /** Hoje (`AAAA-MM-DD`), só depois de montar no navegador. */
  readonly today: string | undefined;
  readonly filter: Pick<BoardFilter, 'filtering' | 'matches'>;
  /** Card mostrado no painel de detalhes agora. */
  readonly shownCardId: string | undefined;
  /** Card sendo arrastado. */
  readonly draggedId: string | null;
  /** Card pego pelo teclado. */
  readonly grabbedId: string | null;
  readonly instructionsId: string;
  readonly actions: KanbanCardActions;
}

/** Monta a função que desenha um card do quadro, igual nas colunas e nas linhas por card pai. */
export function cardRenderer(params: CardRendererParams): RenderCard {
  const { lookups, filter } = params;

  return function renderCard(placement: CardPlacement) {
    const { card, lane } = placement;
    const parentTitle = card.parentId
      ? lookups.titles.get(card.parentId)
      : undefined;
    const assignee = card.assigneeId
      ? lookups.people.get(card.assigneeId)
      : undefined;
    const outsideFilter = filter.filtering && !filter.matches(card);

    return (
      <KanbanCard
        key={card.id}
        card={card}
        keyPrefix={params.keyPrefix}
        index={placement.index}
        parentTitle={parentTitle}
        childCount={lookups.childCounts.get(card.id) ?? 0}
        progress={lookups.progress.get(card.id)}
        assignee={assignee}
        blocked={lookups.blocked.has(card.id)}
        labels={cardLabels({ card, labels: params.labels })}
        today={params.today}
        dimmed={outsideFilter}
        open={params.shownCardId === card.id}
        dragging={params.draggedId === card.id}
        grabbed={params.grabbedId === card.id}
        dropBefore={placement.dropBefore}
        locked={lane.locked}
        instructionsId={params.instructionsId}
        actions={params.actions}
      />
    );
  };
}
