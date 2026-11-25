import type { Connection, FinalConnectionState } from '@xyflow/react';
import { useRef, useState } from 'react';

import {
  connectionProblem,
  type DraggedConnection,
  draggedRequest,
  refusalText,
} from './model/connections';
import { reconnectEdge } from './model/editing';
import type { ProcessEdge, ProcessGraph } from './process-graph';
import type { GraphChange } from './use-document-history';

export interface UseConnectionCommandsParams {
  readonly graph: ProcessGraph;
  readonly change: (change: GraphChange) => void;
  readonly createId: () => string;
}

/** Ligação arrastada até um ponto, lida do estado final do React Flow; `null` quando ela não chegou a um ponto. */
export function draggedFrom(
  state: FinalConnectionState,
): DraggedConnection | null {
  const { fromNode, fromHandle, toNode, toHandle } = state;
  if (!fromNode || !fromHandle || !toNode || !toHandle) {
    return null;
  }
  return {
    fromNodeId: fromNode.id,
    fromHandleId: fromHandle.id ?? null,
    fromHandleRole: fromHandle.type,
    toNodeId: toNode.id,
    toHandleId: toHandle.id ?? null,
  };
}

/**
 * Ligar e religar blocos pelo canvas. A regra é a mesma do modelo: o canvas a consulta durante o arraste, para pintar a
 * linha e dizer o motivo da recusa, e o comando a aplica de novo antes de gravar. A última recusa fica guardada até a
 * próxima ligação feita ou até o usuário fechar o aviso.
 */
export function useConnectionCommands({
  graph,
  change,
  createId,
}: Readonly<UseConnectionCommandsParams>) {
  // NOTE: durante a reconexão, a conexão arrastada não conta como ocupando a saída nem a entrada.
  const reconnecting = useRef<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);

  /** Motivo, em PT-BR, para a ligação arrastada não poder ser feita; `null` quando ela pode. */
  function explainConnection(dragged: DraggedConnection): string | null {
    const problem = connectionProblem({
      graph,
      connection: draggedRequest(dragged),
      ignoreEdgeId: reconnecting.current ?? undefined,
    });
    return problem === null ? null : refusalText(problem);
  }

  function isValidConnection(connection: Connection | ProcessEdge): boolean {
    const problem = connectionProblem({
      graph,
      connection,
      ignoreEdgeId: reconnecting.current ?? undefined,
    });
    return problem === null;
  }

  function onConnect(connection: Connection) {
    setRefusal(null);
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

  /** Ligação solta sobre um ponto que a recusa: guarda o motivo para o aviso. */
  function reportRefusal(state: FinalConnectionState) {
    const dragged = draggedFrom(state);
    if (state.isValid || dragged === null) {
      return;
    }
    setRefusal(explainConnection(dragged));
  }

  // WHY: os callbacks de reconexão seguem a assinatura posicional que o React Flow chama.
  function onReconnectStart(_event: unknown, edge: ProcessEdge) {
    reconnecting.current = edge.id;
  }

  function onReconnect(edge: ProcessEdge, connection: Connection) {
    setRefusal(null);
    change({
      update: (current) =>
        reconnectEdge({ graph: current, edgeId: edge.id, connection }),
    });
  }

  function onReconnectEnd(
    _event: unknown,
    _edge: ProcessEdge,
    _handleType: unknown,
    state: FinalConnectionState,
  ) {
    reportRefusal(state);
    reconnecting.current = null;
  }

  return {
    refusal,
    dismissRefusal: () => setRefusal(null),
    explainConnection,
    reportRefusal,
    isValidConnection,
    onConnect,
    onReconnectStart,
    onReconnect,
    onReconnectEnd,
  };
}
