import { useState } from 'react';

import type { Announce, Notice, Notify } from './board-notices';

/** O que o quadro diz a quem usa: o anúncio para o leitor de tela e o aviso visível acima do quadro. */
export interface BoardFeedback {
  /** Último texto anunciado ao leitor de tela. */
  readonly announcement: string;
  readonly announce: Announce;
  readonly notice: Notice | null;
  readonly notify: Notify;
  /** Mostra o motivo pelo qual o quadro recusou uma mudança, como aviso acima do quadro. */
  readonly warn: (text: string) => void;
  readonly dismissNotice: () => void;
}

export function useBoardFeedback(): BoardFeedback {
  const [announcement, setAnnouncement] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);

  return {
    announcement,
    announce: setAnnouncement,
    notice,
    notify: setNotice,
    warn: (text) => setNotice({ color: 'warning', text }),
    dismissNotice: () => setNotice(null),
  };
}
