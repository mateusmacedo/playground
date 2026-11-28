import { type TreeRow, treeRows } from './model/hierarchy-views';
import type { ListRow } from './model/views';

/** A lista em árvore pronta para desenhar: as linhas à vista e o nível e o estado de cada uma. */
export interface ListTree {
  /** As linhas à vista, cada card logo abaixo do pai. */
  readonly rows: readonly ListRow[];
  /** Nível, filhos e estado de cada linha à vista, pelo id do card. */
  readonly nodes: ReadonlyMap<string, TreeRow>;
  /** Recolhe ou expande os filhos do card. */
  readonly toggle: (cardId: string) => void;
}

export interface ListTreeParams {
  /** As linhas já filtradas e ordenadas; a árvore mantém essa ordem dentro de cada nível. */
  readonly rows: readonly ListRow[];
  /** Ids dos cards com os filhos recolhidos, como a preferência de visão guarda. */
  readonly collapsedRows: readonly string[];
  /** Recebe a nova lista de recolhidos, para gravar na preferência de visão. */
  readonly onChange: (collapsedRows: readonly string[]) => void;
}

/** Monta a lista em árvore a partir das linhas e dos cards recolhidos, com a ação de recolher e expandir. */
export function listTree(params: ListTreeParams): ListTree {
  const { rows, collapsedRows, onChange } = params;
  const collapsed = new Set(collapsedRows);
  const visible = treeRows({ rows, collapsed });
  const nodes = new Map<string, TreeRow>();
  for (const node of visible) {
    nodes.set(node.row.card.id, node);
  }

  function toggle(cardId: string) {
    const next = new Set(collapsed);
    if (!next.delete(cardId)) {
      next.add(cardId);
    }
    onChange([...next]);
  }

  return { rows: visible.map((node) => node.row), nodes, toggle };
}
