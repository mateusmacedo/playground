import { cilChevronBottom, cilChevronRight } from '@coreui/icons';
import CIcon from '@coreui/icons-react';

import { BlockedBadge } from './blocked-badge';
import type { ListTree } from './list-tree';
import type { BoardCard } from './model/board';
import type { TreeRow } from './model/hierarchy-views';

export interface BoardListTitleProps {
  readonly card: BoardCard;
  /** O card tem bloqueador fora da coluna de conclusão. */
  readonly blocked: boolean;
  /** A lista em árvore, com o nível e os filhos de cada linha; sem ela, a lista é plana. */
  readonly tree?: ListTree;
  readonly onOpen: (cardId: string) => void;
}

/**
 * Título do card na lista: abre o card no painel e leva o selo "Bloqueado". Na lista em árvore, vem com o recuo do
 * nível e, no card que tem filhos à vista, o botão que os recolhe e expande.
 */
export function BoardListTitle({
  card,
  blocked,
  tree,
  onOpen,
}: Readonly<BoardListTitleProps>) {
  const node = tree?.nodes.get(card.id);
  const depth = node?.depth ?? 0;
  return (
    <div
      className="d-flex align-items-center gap-1"
      style={{ paddingInlineStart: `${depth * 1.5}rem` }}
    >
      {tree && node ? (
        <TreeToggle card={card} node={node} onToggle={tree.toggle} />
      ) : null}
      {depth > 0 ? (
        <span className="visually-hidden">Nível {depth + 1}:</span>
      ) : null}
      <button
        type="button"
        className="btn btn-link p-0 text-start"
        data-card-open={card.id}
        onClick={() => onOpen(card.id)}
      >
        {card.title}
      </button>
      {blocked ? <BlockedBadge className="ms-1" /> : null}
    </div>
  );
}

interface TreeToggleProps {
  readonly card: BoardCard;
  readonly node: TreeRow;
  readonly onToggle: (cardId: string) => void;
}

/** Botão que recolhe e expande os filhos; o card sem filhos à vista ganha só o espaço dele, para os títulos alinharem. */
function TreeToggle({ card, node, onToggle }: Readonly<TreeToggleProps>) {
  if (!node.hasChildren) {
    return <span className="kanban-list__toggle" aria-hidden="true" />;
  }
  return (
    <button
      type="button"
      className="btn btn-sm btn-ghost-secondary p-0 kanban-list__toggle"
      aria-expanded={!node.collapsed}
      aria-label={`Filhos de ${card.title}`}
      onClick={() => onToggle(card.id)}
    >
      <CIcon
        icon={node.collapsed ? cilChevronRight : cilChevronBottom}
        size="sm"
        aria-hidden="true"
      />
    </button>
  );
}
