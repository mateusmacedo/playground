import { useEffect, useState } from 'react';

import type { BoardLane } from './model/board';
import { parseStoredBoard, serializeBoard } from './model/storage';

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    // NOTE: com o armazenamento bloqueado pelo navegador, o quadro segue só na memória.
    return null;
  }
}

function writeStorage(params: {
  readonly key: string;
  readonly value: string;
}): void {
  try {
    window.localStorage.setItem(params.key, params.value);
  } catch {
    // NOTE: cota cheia ou armazenamento bloqueado; o quadro segue só na memória.
  }
}

/**
 * Estado das colunas que, com `storageKey`, sobrevive ao recarregar a página. O servidor e a primeira renderização usam
 * `initial`, como no HTML que veio do servidor; depois de montar, o quadro gravado e válido substitui o inicial e cada
 * mudança é gravada. Sem `storageKey`, é um `useState` comum.
 */
export function useStoredBoard(params: {
  readonly initial: readonly BoardLane[];
  readonly storageKey?: string;
}): readonly [readonly BoardLane[], (lanes: readonly BoardLane[]) => void] {
  const { initial, storageKey } = params;
  const [lanes, setLanes] = useState(initial);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!storageKey) {
      return;
    }
    const stored = parseStoredBoard(readStorage(storageKey));
    if (stored) {
      setLanes(stored);
    }
    setLoaded(true);
  }, [storageKey]);

  useEffect(() => {
    if (storageKey && loaded) {
      writeStorage({ key: storageKey, value: serializeBoard(lanes) });
    }
  }, [storageKey, loaded, lanes]);

  return [lanes, setLanes];
}
