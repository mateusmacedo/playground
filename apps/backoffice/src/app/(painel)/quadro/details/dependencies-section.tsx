import { useId, useRef } from 'react';
import { flushSync } from 'react-dom';

import type { BoardCommands } from '../board-commands';
import type { Announce } from '../board-notices';
import { type Board, type BoardCard, findCard } from '../model/board';
import {
  blockedCardsOf,
  blockerCandidates,
  blockersOf,
  pendingBlockers,
} from '../model/dependencies';
import { doneLaneOf } from '../model/done-lane';
import { BlockerAddForm } from './blocker-add-form';
import { BlockerList } from './blocker-list';

export interface DependenciesSectionProps {
  readonly card: BoardCard;
  readonly board: Board;
  readonly commands: Pick<BoardCommands, 'addBlocker' | 'removeBlocker'>;
  readonly onOpenCard: (cardId: string) => void;
  /** Diz ao leitor de tela o que mudou; sem ele, a seção muda em silêncio. */
  readonly onAnnounce?: Announce;
}

/**
 * Dependências do card: os cards que o bloqueiam, com a coluna e a situação de cada um, o campo para adicionar mais
 * um e, só para leitura, os cards que ele bloqueia.
 */
export function DependenciesSection({
  card,
  board,
  commands,
  onOpenCard,
  onAnnounce,
}: Readonly<DependenciesSectionProps>) {
  const headingId = useId();
  const blockersId = useId();
  const blockedId = useId();
  const selectRef = useRef<HTMLSelectElement>(null);
  const blockersRef = useRef<HTMLHeadingElement>(null);
  const { lanes } = board;
  const cardId = card.id;

  function laneTitleOf(otherId: string): string | undefined {
    return findCard({ lanes, cardId: otherId })?.lane.title;
  }

  const pendingIds = new Set(
    pendingBlockers({ board, cardId }).map((blocker) => blocker.id),
  );
  const blockers = blockersOf({ lanes, cardId }).map((blocker) => ({
    card: blocker,
    laneTitle: laneTitleOf(blocker.id),
    pending: pendingIds.has(blocker.id),
  }));
  const candidates = blockerCandidates({ lanes, cardId }).map((candidate) => ({
    card: candidate,
    laneTitle: laneTitleOf(candidate.id),
  }));
  const blocked = blockedCardsOf({ lanes, cardId });

  // WHY: o controle em foco pode sair da tela com a mudança: o botão do bloqueador removido, ou o campo quando o
  // último card possível vira bloqueador. O foco vai para o campo e, sem ele, para o título da lista; só depois que a
  // seção é redesenhada dá para saber qual dos dois está na tela.
  function focusAfterChange() {
    const target = selectRef.current ?? blockersRef.current;
    target?.focus();
  }

  function add(blocker: BoardCard): string | undefined {
    const refusal = flushSync(() =>
      commands.addBlocker({ cardId, blockerId: blocker.id }),
    );
    if (refusal === undefined) {
      onAnnounce?.(`Card ${blocker.title} passou a bloquear ${card.title}.`);
      focusAfterChange();
    }
    return refusal;
  }

  function remove(blocker: BoardCard) {
    flushSync(() => commands.removeBlocker({ cardId, blockerId: blocker.id }));
    onAnnounce?.(`Card ${blocker.title} deixou de bloquear ${card.title}.`);
    focusAfterChange();
  }

  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId} className="h6">
        Dependências
      </h3>
      <h4
        ref={blockersRef}
        id={blockersId}
        className="small fw-semibold mb-1"
        tabIndex={-1}
      >
        Bloqueado por
      </h4>
      {blockers.length > 0 && !doneLaneOf(board) ? (
        <p className="small text-body-secondary mb-1">
          O quadro não tem coluna de conclusão: todo bloqueador conta como
          pendente.
        </p>
      ) : null}
      <BlockerList
        labelledBy={blockersId}
        blockers={blockers}
        onOpenCard={onOpenCard}
        onRemove={remove}
      />
      <BlockerAddForm
        candidates={candidates}
        selectRef={selectRef}
        onAdd={add}
      />
      <h4 id={blockedId} className="small fw-semibold mt-3 mb-1">
        Bloqueia
      </h4>
      {blocked.length > 0 ? (
        <ul
          aria-labelledby={blockedId}
          className="list-unstyled d-grid gap-1 mb-0"
        >
          {blocked.map((other) => (
            <li key={other.id}>
              <button
                type="button"
                className="btn btn-link p-0 text-start align-baseline"
                onClick={() => onOpenCard(other.id)}
              >
                {other.title}
              </button>{' '}
              <span className="small text-body-secondary">
                ({laneTitleOf(other.id)})
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="small text-body-secondary mb-0">
          Este card não bloqueia nenhum outro.
        </p>
      )}
    </section>
  );
}
