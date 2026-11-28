import { createContext, type ReactNode, useContext } from 'react';

import type { RunMark } from './run-marks';

/** Marcas da execução no nível mostrado: a de cada bloco e as conexões já percorridas. */
export interface LevelMarks {
  readonly nodes: ReadonlyMap<string, RunMark>;
  readonly takenEdges: ReadonlySet<string>;
}

const RunMarksContext = createContext<LevelMarks | null>(null);

export interface RunMarksProviderProps {
  readonly value: LevelMarks;
  readonly children: ReactNode;
}

/** Entrega aos blocos e às conexões do diagrama as marcas da execução, sem guardar dado derivado neles. */
export function RunMarksProvider({
  value,
  children,
}: Readonly<RunMarksProviderProps>) {
  return <RunMarksContext value={value}>{children}</RunMarksContext>;
}

function useLevelMarks(): LevelMarks {
  const marks = useContext(RunMarksContext);
  if (!marks) {
    throw new Error('As marcas da execução precisam do RunMarksProvider.');
  }
  return marks;
}

/** Marca do bloco; `undefined` quando a execução ainda não o alcançou. */
export function useNodeMark(nodeId: string): RunMark | undefined {
  return useLevelMarks().nodes.get(nodeId);
}

/** Diz se a execução já passou pela conexão. */
export function useEdgeTaken(edgeId: string): boolean {
  return useLevelMarks().takenEdges.has(edgeId);
}
