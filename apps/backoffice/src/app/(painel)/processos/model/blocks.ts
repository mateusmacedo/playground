export type BlockKind =
  | 'start'
  | 'task'
  | 'decision'
  | 'merge'
  | 'end'
  | 'annotation';

/** Um caminho de saída da Decisão; o `id` também é o id do ponto de saída dele. */
export interface Branch {
  readonly id: string;
  readonly label: string;
}

// WHY: `type`, e não `interface`, porque o React Flow exige `data` atribuível a `Record<string, unknown>`, e só alias
// de tipo ganha a assinatura de índice implícita.
export type BlockData = {
  readonly label: string;
  readonly description?: string;
  readonly branches?: readonly Branch[];
};

/** Dados próprios da conexão; o rótulo de um ramo vem do ramo, não daqui. */
export type LinkData = {
  readonly label?: string;
};

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** O mínimo de um bloco que as regras leem; os nós do React Flow já têm esse formato. */
export interface GraphNode {
  readonly id: string;
  readonly type?: string;
  readonly position: Point;
  readonly data: BlockData;
  readonly selected?: boolean;
}

/** O mínimo de uma conexão que as regras leem. */
export interface GraphEdge {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly sourceHandle?: string | null;
  readonly targetHandle?: string | null;
  readonly selected?: boolean;
}

export interface Graph<
  N extends GraphNode = GraphNode,
  E extends GraphEdge = GraphEdge,
> {
  readonly nodes: readonly N[];
  readonly edges: readonly E[];
}

/** Quantas conexões o bloco aceita chegando: nenhuma, uma ou várias. */
export type InputLimit = 'none' | 'one' | 'many';

/** Como o bloco sai: sem saída, por uma saída única ou por um ponto por ramo. */
export type OutputMode = 'none' | 'single' | 'branches';

export interface BlockSpec {
  readonly kind: BlockKind;
  readonly label: string;
  readonly hint: string;
  readonly input: InputLimit;
  readonly output: OutputMode;
}

/** Id do ponto de entrada de todo bloco que aceita conexão. */
export const INPUT_HANDLE = 'in';
/** Id do ponto de saída dos blocos de saída única. */
export const OUTPUT_HANDLE = 'out';

const SPEC_BY_KIND: Readonly<Record<BlockKind, BlockSpec>> = {
  start: {
    kind: 'start',
    label: 'Início',
    hint: 'Ponto de partida do processo.',
    input: 'none',
    output: 'single',
  },
  task: {
    kind: 'task',
    label: 'Etapa',
    hint: 'Uma atividade do processo.',
    input: 'one',
    output: 'single',
  },
  decision: {
    kind: 'decision',
    label: 'Decisão',
    hint: 'Divide o fluxo em dois ou mais caminhos.',
    input: 'one',
    output: 'branches',
  },
  merge: {
    kind: 'merge',
    label: 'Convergência',
    hint: 'Reúne vários caminhos em um só.',
    input: 'many',
    output: 'single',
  },
  end: {
    kind: 'end',
    label: 'Fim',
    hint: 'Encerra o processo.',
    input: 'many',
    output: 'none',
  },
  annotation: {
    kind: 'annotation',
    label: 'Anotação',
    hint: 'Nota livre, sem conexões.',
    input: 'none',
    output: 'none',
  },
};

/** Os blocos na ordem da biblioteca. */
export const BLOCK_SPECS: readonly BlockSpec[] = [
  SPEC_BY_KIND.start,
  SPEC_BY_KIND.task,
  SPEC_BY_KIND.decision,
  SPEC_BY_KIND.merge,
  SPEC_BY_KIND.end,
  SPEC_BY_KIND.annotation,
];

export function isBlockKind(value: unknown): value is BlockKind {
  return typeof value === 'string' && Object.hasOwn(SPEC_BY_KIND, value);
}

/** Tipo do bloco; um nó sem tipo conhecido conta como Etapa, o tipo padrão. */
export function kindOf(node: Pick<GraphNode, 'type'>): BlockKind {
  return isBlockKind(node.type) ? node.type : 'task';
}

export function specOf(kind: BlockKind): BlockSpec {
  return SPEC_BY_KIND[kind];
}

/** Nome do bloco na tela: o título dado pelo usuário ou, vazio, o nome do tipo. */
export function blockName(node: Pick<GraphNode, 'type' | 'data'>): string {
  return node.data.label.trim() || specOf(kindOf(node)).label;
}

/** Ids dos pontos de saída do bloco: o único, um por ramo ou nenhum. */
export function outputHandles(node: GraphNode): readonly string[] {
  const { output } = specOf(kindOf(node));
  if (output === 'single') {
    return [OUTPUT_HANDLE];
  }
  if (output === 'branches') {
    return (node.data.branches ?? []).map((branch) => branch.id);
  }
  return [];
}

export interface CreateBlockParams {
  readonly kind: BlockKind;
  readonly position: Point;
  readonly createId: () => string;
}

/** Bloco novo com os dados padrão do tipo; a Decisão já nasce com os ramos "Sim" e "Não". */
export function createBlock(params: CreateBlockParams) {
  const { kind, position, createId } = params;
  const label = specOf(kind).label;
  const data: BlockData =
    kind === 'decision'
      ? {
          label,
          branches: [
            { id: createId(), label: 'Sim' },
            { id: createId(), label: 'Não' },
          ],
        }
      : { label };
  return { id: createId(), type: kind, position, data };
}
