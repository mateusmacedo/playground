import { useEffect, useState } from 'react';

import { readStorage, writeStorage } from './browser-storage';

function parseIds(raw: string | null): readonly string[] {
  try {
    const data: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(data)
      ? data.filter((id): id is string => typeof id === 'string')
      : [];
  } catch {
    return [];
  }
}

export interface CollapsedLanes {
  readonly collapsed: ReadonlySet<string>;
  readonly toggle: (laneId: string) => void;
  readonly expand: (laneIds: Iterable<string>) => void;
}

/**
 * Colunas recolhidas, uma preferência de tela: com `storageKey`, ficam gravadas numa chave própria e não entram no
 * desfazer do quadro.
 */
export function useCollapsedLanes(storageKey?: string): CollapsedLanes {
  const key = storageKey ? `${storageKey}:recolhidas` : undefined;
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [loaded, setLoaded] = useState(!key);

  useEffect(() => {
    if (!key) {
      return;
    }
    setCollapsed(new Set(parseIds(readStorage(key))));
    setLoaded(true);
  }, [key]);

  useEffect(() => {
    if (key && loaded) {
      writeStorage({ key, value: JSON.stringify([...collapsed]) });
    }
  }, [key, loaded, collapsed]);

  return {
    collapsed,
    toggle: (laneId) =>
      setCollapsed((current) => {
        const next = new Set(current);
        if (!next.delete(laneId)) {
          next.add(laneId);
        }
        return next;
      }),
    expand: (laneIds) =>
      setCollapsed((current) => {
        const next = new Set(current);
        for (const laneId of laneIds) {
          next.delete(laneId);
        }
        return next.size === current.size ? current : next;
      }),
  };
}
