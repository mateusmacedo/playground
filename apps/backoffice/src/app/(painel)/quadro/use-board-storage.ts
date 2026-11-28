import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import { useReloadOnFocus } from '@/shared/hooks/use-reload-on-focus';

import type { Board } from './model/board';
import { type BoardStore, SAVED, type SaveStatus } from './store/board-store';
import {
  failedPhase,
  LOADING,
  type LoadPhase,
  READY,
} from './store/load-phase';
import { useUnsavedWarning } from './use-unsaved-warning';

export interface UseBoardStorageParams {
  /** Onde o quadro é lido e gravado; sem ele, o quadro vive só na memória. */
  readonly store: BoardStore | undefined;
  readonly board: Board;
  /** Chegou um quadro válido de fora: o gravado, ao abrir a página, o de outra aba ou o do servidor. */
  readonly onStoredBoard: (board: Board) => void;
}

/** As saídas da gravação num servidor: tentar de novo depois da falha e escolher a versão que vale num conflito. */
export interface SaveActions {
  readonly retry: () => void;
  readonly keepMine: () => void;
  readonly takeTheirs: () => void;
}

export interface BoardStorage {
  /** O quadro gravado já foi lido (ou não há o que ler). */
  readonly loaded: boolean;
  /**
   * O que a tela mostra no lugar do quadro. Só o quadro que vem de um servidor passa por `loading` e `failed`: o do
   * navegador é lido na hora, e a tela mostra o quadro inicial enquanto isso.
   */
  readonly phase: LoadPhase;
  readonly retryLoad: () => void;
  readonly save: SaveStatus;
  /** Presente quando o quadro é gravado num servidor. */
  readonly saveActions?: SaveActions;
  /**
   * Envia já o que espera para ser gravado e devolve a situação da gravação quando não há mais envio pendente. Presente
   * quando o quadro é gravado num servidor: é o que espera quem vai abrir uma página que lê o quadro de lá.
   */
  readonly flush?: () => Promise<SaveStatus>;
}

/** A leitura de um armazenamento; trocar de armazenamento recomeça a leitura. */
interface Reading {
  readonly store: BoardStore | undefined;
  readonly phase: LoadPhase;
}

const NOT_STORED: Reading = { store: undefined, phase: READY };

function alwaysSaved(): SaveStatus {
  return SAVED;
}

function neverChanges(): () => void {
  return () => undefined;
}

/**
 * Liga o quadro da tela ao armazenamento dele: lê ao montar, entrega o que muda fora desta tela (outra aba, ou o
 * servidor a cada volta para a aba) e manda gravar cada mudança, sem esperar a gravação terminar.
 */
export function useBoardStorage(params: UseBoardStorageParams): BoardStorage {
  const { store, board } = params;
  const [reading, setReading] = useState(NOT_STORED);
  const phase = reading.store === store ? reading.phase : LOADING;
  const loaded = phase.kind === 'ready';
  const loading = phase.kind === 'loading';
  const save = useSyncExternalStore(
    store?.subscribe ?? neverChanges,
    store?.status ?? alwaysSaved,
    alwaysSaved,
  );
  /** Armazenamento que esta tela está usando agora, para descartar o que chegar de um anterior. */
  const inUse = useRef<BoardStore | undefined>(undefined);

  const receive = useEffectEvent((stored: Board) => {
    params.onStoredBoard(stored);
  });

  useEffect(() => {
    if (!store || !loading) {
      return;
    }
    let current = true;
    void store.load().then((result) => {
      if (!current) {
        return;
      }
      if (result.kind === 'found') {
        receive(result.board);
      }
      const next =
        result.kind === 'failed' ? failedPhase(result.message) : READY;
      setReading({ store, phase: next });
    });
    return () => {
      current = false;
    };
  }, [store, loading]);

  useEffect(() => {
    inUse.current = store;
    const stopWatching = store?.watch?.((stored) => receive(stored));
    return () => {
      inUse.current = undefined;
      stopWatching?.();
      // NOTE: a mudança que esperava a vez é enviada na saída, para não se perder na troca de quadro ou de rota.
      void store?.remote?.flush();
    };
  }, [store]);

  useEffect(() => {
    if (store && loaded) {
      store.save(board);
    }
  }, [store, loaded, board]);

  const remote = store?.remote;
  // NOTE: o quadro do navegador é gravado na hora; só o do servidor passa um tempo com mudança por gravar.
  useUnsavedWarning(remote !== undefined && save.kind !== 'saved');

  /** Entrega à tela o quadro que o servidor devolveu, se ela ainda estiver neste armazenamento. */
  function deliver(fresh: Board | null) {
    if (fresh !== null && inUse.current === store) {
      params.onStoredBoard(fresh);
    }
  }

  useReloadOnFocus({
    enabled: remote !== undefined && loaded && save.kind === 'saved',
    reload: () => {
      void remote?.refresh().then(deliver);
    },
  });

  return {
    loaded,
    phase: remote ? phase : READY,
    retryLoad: () => setReading({ store, phase: LOADING }),
    save,
    saveActions: remote && {
      retry: remote.retry,
      keepMine: remote.keepMine,
      takeTheirs: () => {
        void remote.takeTheirs().then(deliver);
      },
    },
    flush:
      store && remote
        ? () => remote.flush().then(() => store.status())
        : undefined,
  };
}
