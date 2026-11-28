import { createContext, type ReactNode, useContext, useMemo } from 'react';

import type { Board } from './model/board';
import { hasRunningProcess, processSummaries } from './model/process-summaries';
import type { ProcessSummary } from './model/process-summary';
import type { SaveStatus } from './store/board-store';
import { useProcessClock } from './use-process-clock';

/** O que o quadro oferece às telas do processo dos cards: os resumos, o relógio e a gravação. */
export interface ProcessBoard {
  /** Instante atual (ISO 8601), para dizer o que está atrasado; só existe com processo em andamento no quadro. */
  readonly now: string | undefined;
  /** Resumo do processo de cada card das colunas, pelo id do card. */
  readonly summaries: ReadonlyMap<string, ProcessSummary>;
  /** Espera a gravação do quadro no servidor e devolve como ela ficou; ausente no quadro gravado no navegador. */
  readonly flush?: () => Promise<SaveStatus>;
}

const NO_SUMMARIES: ReadonlyMap<string, ProcessSummary> = new Map();

// NOTE: é o que vale para a tela desenhada fora de um quadro: nenhum resumo, nada atrasado e nada por gravar.
const OUTSIDE_BOARD: ProcessBoard = { now: undefined, summaries: NO_SUMMARIES };

const ProcessBoardContext = createContext<ProcessBoard>(OUTSIDE_BOARD);

export interface ProcessBoardProviderProps {
  readonly board: Board;
  /** A espera pela gravação do quadro, quando ele é gravado num servidor. */
  readonly flush?: () => Promise<SaveStatus>;
  readonly children: ReactNode;
}

/**
 * Entrega às telas do processo, em qualquer ponto do quadro, o que elas precisam dele. Existe porque o selo do card,
 * a lista e o painel de detalhes ficam em ramos diferentes da tela, e os três mostram o mesmo resumo com o mesmo
 * relógio.
 */
export function ProcessBoardProvider({
  board,
  flush,
  children,
}: Readonly<ProcessBoardProviderProps>) {
  const now = useProcessClock(hasRunningProcess(board));
  const summaries = useMemo(
    () => processSummaries({ board, now }),
    [board, now],
  );

  return (
    <ProcessBoardContext value={{ now, summaries, flush }}>
      {children}
    </ProcessBoardContext>
  );
}

export function useProcessBoard(): ProcessBoard {
  return useContext(ProcessBoardContext);
}
