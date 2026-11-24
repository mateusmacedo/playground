import { useState } from 'react';

/** Janelas abertas pela barra do quadro: lista de arquivados, etiquetas e configuração. */
export type ListDialogKind = 'archive' | 'labels' | 'settings';

export interface ListDialogs {
  /** Janela aberta agora; só uma por vez. */
  readonly open: ListDialogKind | null;
  /** Quantas vezes a configuração foi aberta: muda a cada abertura, para os campos começarem do valor atual. */
  readonly settingsOpenCount: number;
  readonly show: (kind: ListDialogKind) => void;
  readonly close: () => void;
}

export function useListDialogs(): ListDialogs {
  const [open, setOpen] = useState<ListDialogKind | null>(null);
  const [settingsOpenCount, setSettingsOpenCount] = useState(0);

  function show(kind: ListDialogKind) {
    if (kind === 'settings') {
      setSettingsOpenCount((count) => count + 1);
    }
    setOpen(kind);
  }

  return { open, settingsOpenCount, show, close: () => setOpen(null) };
}
