import { createContext, type ReactNode, useContext } from 'react';

import type { DraggedConnection } from './model/connections';

/** O que os blocos e as conexões do canvas pedem ao editor, sem receber o estado inteiro por props. */
export interface CanvasActions {
  readonly openSubprocess: (nodeId: string) => void;
  readonly requestInsertOnEdge: (edgeId: string) => void;
  /** Motivo, em PT-BR, para a ligação arrastada não poder ser feita; `null` quando ela pode. */
  readonly explainConnection: (dragged: DraggedConnection) => string | null;
}

const CanvasActionsContext = createContext<CanvasActions | null>(null);

export interface CanvasActionsProviderProps {
  readonly value: CanvasActions;
  readonly children: ReactNode;
}

export function CanvasActionsProvider({
  value,
  children,
}: Readonly<CanvasActionsProviderProps>) {
  return <CanvasActionsContext value={value}>{children}</CanvasActionsContext>;
}

export function useCanvasActions(): CanvasActions {
  const actions = useContext(CanvasActionsContext);
  if (!actions) {
    throw new Error(
      'useCanvasActions precisa estar dentro do CanvasActionsProvider.',
    );
  }
  return actions;
}
