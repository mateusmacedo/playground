import { useEffect, useEffectEvent, useRef, useState } from 'react';

import { readStorage, subscribeStorage, writeStorage } from './browser-storage';
import type { Board } from './model/board';
import { parseStoredBoard, serializeBoard } from './model/storage';

export interface UseBoardStorageParams {
  /** Chave do quadro no navegador; sem ela, o quadro vive só na memória. */
  readonly storageKey: string | undefined;
  readonly board: Board;
  /** Chegou um quadro válido do navegador: o gravado, ao abrir a página, ou o que outra aba acabou de gravar. */
  readonly onStoredBoard: (board: Board) => void;
}

export interface BoardStorage {
  /** O quadro gravado já foi lido (ou não há o que ler). */
  readonly loaded: boolean;
  /** A última gravação falhou, quase sempre por falta de espaço no navegador. */
  readonly storageFull: boolean;
}

/** Lê o quadro gravado ao montar, acompanha o que as outras abas gravam e grava cada mudança desta aba. */
export function useBoardStorage(params: UseBoardStorageParams): BoardStorage {
  const { storageKey, board } = params;
  const [loaded, setLoaded] = useState(!storageKey);
  const [storageFull, setStorageFull] = useState(false);
  /** Último quadro lido do navegador, que não precisa ser gravado de volta. */
  const fromStorage = useRef<Board | null>(null);

  const receive = useEffectEvent((raw: string | null) => {
    const stored = parseStoredBoard(raw);
    if (stored) {
      fromStorage.current = stored;
      params.onStoredBoard(stored);
    }
  });

  useEffect(() => {
    if (!storageKey) {
      return;
    }
    receive(readStorage(storageKey));
    setLoaded(true);
    return subscribeStorage({
      key: storageKey,
      onChange: (raw) => receive(raw),
    });
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || !loaded) {
      return;
    }
    // NOTE: regravar o que veio de outra aba devolveria a ela, com outra ordem de campos, uma mudança que não houve.
    if (board === fromStorage.current) {
      return;
    }
    const saved = writeStorage({
      key: storageKey,
      value: serializeBoard(board),
    });
    setStorageFull(!saved);
  }, [storageKey, loaded, board]);

  return { loaded, storageFull };
}
