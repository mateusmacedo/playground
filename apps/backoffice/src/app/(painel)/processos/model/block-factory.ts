import {
  type BlockData,
  type BlockKind,
  type Branch,
  INPUT_HANDLE,
  type InnerProcess,
  OUTPUT_HANDLE,
  type Point,
  specOf,
} from './blocks';
import { DEFAULT_DURATION } from './fields';
import { suggestedName } from './names';

/** Distância vertical entre o Início e o Fim do canvas interno de um subprocesso novo. */
const INNER_GAP = 160;

interface IdSource {
  readonly createId: () => string;
}

/** Palavra do nome provisório de um ramo: "Caminho 1", "Caminho 2" e assim por diante. */
const BRANCH_PREFIX = 'Caminho';

/** Nome sugerido para o ramo de número `position` (a partir de 1). */
export function suggestedBranchLabel(position: number): string {
  return `${BRANCH_PREFIX} ${position}`;
}

/** Nome sugerido para um ramo novo: o primeiro "Caminho N" que nenhum ramo do bloco usa. */
export function nextBranchLabel(branches: readonly Branch[]): string {
  const taken = branches.map((branch) => branch.label);
  return suggestedName({ prefix: BRANCH_PREFIX, taken });
}

function numberedBranches({ createId }: IdSource): Branch[] {
  return [
    { id: createId(), label: suggestedBranchLabel(1) },
    { id: createId(), label: suggestedBranchLabel(2) },
  ];
}

/** Canvas interno de um subprocesso novo: Início ligado ao Fim, já válido. */
function startToEnd({ createId }: IdSource): InnerProcess {
  const startId = createId();
  const endId = createId();
  return {
    nodes: [
      {
        id: startId,
        type: 'start',
        position: { x: 0, y: 0 },
        data: { label: specOf('start').label, trigger: 'manual' },
      },
      {
        id: endId,
        type: 'end',
        position: { x: 0, y: INNER_GAP },
        data: { label: specOf('end').label, outcome: 'completed' },
      },
    ],
    edges: [
      {
        id: createId(),
        source: startId,
        target: endId,
        sourceHandle: OUTPUT_HANDLE,
        targetHandle: INPUT_HANDLE,
      },
    ],
  };
}

interface DefaultDataParams extends IdSource {
  readonly kind: BlockKind;
}

function defaultData(params: DefaultDataParams): BlockData {
  const { kind, createId } = params;
  const label = specOf(kind).label;
  switch (kind) {
    case 'decision':
      return {
        label,
        branches: [
          { id: createId(), label: 'Sim' },
          { id: createId(), label: 'Não' },
        ],
      };
    case 'inclusive-split':
    case 'parallel-split':
      return { label, branches: numberedBranches({ createId }) };
    case 'start':
      return { label, trigger: 'manual' };
    case 'end':
      return { label, outcome: 'completed' };
    case 'timer':
      return { label, timerMode: 'duration', duration: DEFAULT_DURATION };
    case 'exception':
      return { label, exceptionTrigger: 'error', interrupting: true };
    case 'subprocess':
      return { label, process: startToEnd({ createId }) };
    default:
      return { label };
  }
}

export interface CreateBlockParams {
  readonly kind: BlockKind;
  readonly position: Point;
  readonly createId: () => string;
}

/** Bloco novo com os dados padrão do tipo; a Decisão exclusiva já nasce com os ramos "Sim" e "Não". */
export function createBlock(params: CreateBlockParams) {
  const { kind, position, createId } = params;
  const data = defaultData({ kind, createId });
  return { id: createId(), type: kind, position, data };
}
