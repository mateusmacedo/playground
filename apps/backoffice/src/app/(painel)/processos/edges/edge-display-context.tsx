import { createContext, type ReactNode, useContext } from 'react';

import type { EdgeDisplay } from '../process-graph';

type EdgeDisplayById = ReadonlyMap<string, EdgeDisplay>;

const FALLBACK: EdgeDisplay = {
  text: '',
  meaning: 'next',
  meaningText: '',
  description: 'conexão',
};

const EdgeDisplayContext = createContext<EdgeDisplayById | null>(null);

export interface EdgeDisplayProviderProps {
  readonly value: EdgeDisplayById;
  readonly children: ReactNode;
}

/** Entrega a cada conexão o rótulo e o significado calculados do grafo, sem guardar dado derivado nela. */
export function EdgeDisplayProvider({
  value,
  children,
}: Readonly<EdgeDisplayProviderProps>) {
  return <EdgeDisplayContext value={value}>{children}</EdgeDisplayContext>;
}

export function useEdgeDisplay(edgeId: string): EdgeDisplay {
  const display = useContext(EdgeDisplayContext);
  if (!display) {
    throw new Error(
      'useEdgeDisplay precisa estar dentro do EdgeDisplayProvider.',
    );
  }
  return display.get(edgeId) ?? FALLBACK;
}
