import {
  type Graph,
  type GraphEdge,
  INPUT_HANDLE,
  kindOf,
  OUTPUT_HANDLE,
  specOf,
} from './blocks';
import { inputLimit, outputHandles } from './ports';

export interface ConnectionRequest {
  readonly source: string;
  readonly target: string;
  readonly sourceHandle?: string | null;
  readonly targetHandle?: string | null;
}

export type ConnectionProblem =
  | 'unknown-block'
  | 'self'
  | 'no-output'
  | 'unknown-output'
  | 'no-input'
  | 'unknown-input'
  | 'duplicate'
  | 'output-taken'
  | 'input-taken';

export const CONNECTION_PROBLEM_TEXT: Readonly<
  Record<ConnectionProblem, string>
> = {
  'unknown-block': 'um dos blocos não existe mais.',
  self: 'o bloco não pode ligar a ele mesmo.',
  'no-output': 'o bloco de origem não tem saída.',
  'unknown-output': 'o ponto de saída não existe mais.',
  'no-input': 'o bloco de destino não aceita entrada.',
  'unknown-input': 'o ponto de chegada não é uma entrada do bloco de destino.',
  duplicate: 'já existe a mesma conexão.',
  'output-taken': 'o ponto de saída já está ligado a outro bloco.',
  'input-taken':
    'o bloco de destino aceita uma só entrada; para reunir caminhos, use uma Convergência.',
};

/** Ponto de saída da conexão; sem id, é a saída única. */
export function sourceHandleOf(edge: Pick<GraphEdge, 'sourceHandle'>): string {
  return edge.sourceHandle ?? OUTPUT_HANDLE;
}

export interface ConnectionProblemParams {
  readonly graph: Graph;
  readonly connection: ConnectionRequest;
  readonly ignoreEdgeId?: string;
}

/**
 * Motivo para recusar a conexão, ou `null` quando ela pode ser criada. `ignoreEdgeId` tira da conta a conexão que está
 * sendo reconectada ou validada, para ela não colidir com ela mesma.
 */
export function connectionProblem(
  params: ConnectionProblemParams,
): ConnectionProblem | null {
  const { graph, connection, ignoreEdgeId } = params;
  const source = graph.nodes.find((node) => node.id === connection.source);
  const target = graph.nodes.find((node) => node.id === connection.target);
  if (!source || !target) {
    return 'unknown-block';
  }
  if (source.id === target.id) {
    return 'self';
  }
  if (specOf(kindOf(source)).output === 'none') {
    return 'no-output';
  }
  const handle = sourceHandleOf(connection);
  if (!outputHandles(source).includes(handle)) {
    return 'unknown-output';
  }
  const targetLimit = inputLimit(target);
  if (targetLimit === 'none') {
    return 'no-input';
  }
  const targetHandle = connection.targetHandle ?? INPUT_HANDLE;
  if (targetHandle !== INPUT_HANDLE) {
    return 'unknown-input';
  }

  const others = graph.edges.filter((edge) => edge.id !== ignoreEdgeId);
  const sameOutput = others.filter(
    (edge) => edge.source === source.id && sourceHandleOf(edge) === handle,
  );
  if (sameOutput.some((edge) => edge.target === target.id)) {
    return 'duplicate';
  }
  if (sameOutput.length > 0) {
    return 'output-taken';
  }
  const targetTaken = others.some((edge) => edge.target === target.id);
  if (targetLimit === 'one' && targetTaken) {
    return 'input-taken';
  }
  return null;
}
