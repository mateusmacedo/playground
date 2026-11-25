import { blockName, type Graph, kindOf, specOf } from './blocks';

export interface SearchResult {
  readonly nodeId: string;
  /** Nome do bloco encontrado. */
  readonly name: string;
  /** Por que ele apareceu: o tipo, o ramo ou o responsável que casou com a busca. */
  readonly detail: string;
}

/** Texto comparável: minúsculo e sem acento, para "decisao" achar "Decisão". */
function normalized(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

export interface SearchParams {
  readonly graph: Graph;
  readonly query: string;
}

/** Blocos cujo nome, ramo ou responsável contém o texto buscado, na ordem do canvas. */
export function searchProcess(params: SearchParams): SearchResult[] {
  const { graph, query } = params;
  const wanted = normalized(query);
  if (wanted === '') {
    return [];
  }
  const results: SearchResult[] = [];
  for (const node of graph.nodes) {
    const name = blockName(node);
    const kindLabel = specOf(kindOf(node)).label;
    const role = node.data.role ?? '';
    const branch = (node.data.branches ?? []).find((candidate) =>
      normalized(candidate.label).includes(wanted),
    );
    if (normalized(name).includes(wanted)) {
      results.push({ nodeId: node.id, name, detail: kindLabel });
    } else if (branch) {
      results.push({ nodeId: node.id, name, detail: `Ramo ${branch.label}` });
    } else if (role !== '' && normalized(role).includes(wanted)) {
      results.push({ nodeId: node.id, name, detail: `Responsável: ${role}` });
    }
  }
  return results;
}
