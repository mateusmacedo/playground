import type { Connection } from '@xyflow/react';
import { useRef } from 'react';

import { connectionProblem } from './model/connections';
import { reconnectEdge } from './model/editing';
import type { ProcessEdge, ProcessGraph } from './process-graph';
import type { GraphChange } from './use-graph-history';

export interface UseConnectionCommandsParams {
  readonly graph: ProcessGraph;
  readonly change: (change: GraphChange) => void;
  readonly createId: () => string;
}

/**
 * Ligar e religar blocos pelo canvas. A regra é a mesma do modelo: o canvas a consulta durante o arraste, para pintar a
 * linha, e o comando a aplica de novo antes de gravar.
 */
export function useConnectionCommands({
  graph,
  change,
  createId,
}: Readonly<UseConnectionCommandsParams>) {
  // NOTE: durante a reconexão, a conexão arrastada não conta como ocupando a saída nem a entrada.
  const reconnecting = useRef<string | null>(null);

  function isValidConnection(connection: Connection | ProcessEdge): boolean {
    const problem = connectionProblem({
      graph,
      connection,
      ignoreEdgeId: reconnecting.current ?? undefined,
    });
    return problem === null;
  }

  function onConnect(connection: Connection) {
    change({
      update: (current) => {
        const problem = connectionProblem({ graph: current, connection });
        if (problem !== null) {
          return current;
        }
        const edge: ProcessEdge = { id: createId(), ...connection };
        return { nodes: current.nodes, edges: [...current.edges, edge] };
      },
    });
  }

  // WHY: os dois callbacks de reconexão seguem a assinatura posicional que o React Flow chama.
  function onReconnectStart(_event: unknown, edge: ProcessEdge) {
    reconnecting.current = edge.id;
  }

  function onReconnect(edge: ProcessEdge, connection: Connection) {
    change({
      update: (current) =>
        reconnectEdge({ graph: current, edgeId: edge.id, connection }),
    });
  }

  function onReconnectEnd() {
    reconnecting.current = null;
  }

  return {
    isValidConnection,
    onConnect,
    onReconnectStart,
    onReconnect,
    onReconnectEnd,
  };
}
