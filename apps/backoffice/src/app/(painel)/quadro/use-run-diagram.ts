import { type MouseEvent, useRef, useState } from 'react';

import type { ProcessRun } from '@/shared/process/run';
import {
  createBrowserRunViewStore,
  type RunViewStore,
  runViewRef,
} from '@/shared/process/run-view-store';

import type { BoardCard } from './model/board';
import { cardKey } from './model/card-key';
import { DEFAULT_BOARD_ID } from './model/workspace';
import { readRequestedBoard } from './use-board-address';
import { useProcessBoard } from './use-process-board';

// NOTE: o endereço da página do diagrama e o parâmetro dela são repetidos aqui porque o quadro não importa nada de
// `processos`; quem define os dois é a página do diagrama.
const RUN_PAGE = '/processos/execucao';
const REF_PARAM = 'ref';

export const RUN_VIEW_REFUSED =
  'O navegador não deixou guardar a situação do processo, e sem ela o diagrama não abre. Libere espaço no navegador e tente de novo.';

export const RUN_NOT_SAVED =
  'O diagrama não abriu porque o quadro ainda não foi gravado no servidor. O aviso acima do quadro diz o motivo.';

const BROWSER_STORE = createBrowserRunViewStore();

/** O clique com tecla modificadora abre o endereço em outra aba ou janela, e esta página continua onde está. */
function opensElsewhere(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.ctrlKey || event.metaKey || event.shiftKey;
}

/** Endereço do card aberto nesta página, sem o domínio, para a página do diagrama trazer a pessoa de volta. */
function cardAddress(key: string): string {
  const url = new URL(window.location.href);
  url.searchParams.set('card', key);
  return `${url.pathname}${url.search}`;
}

export interface UseRunDiagramParams {
  /** Card dono da execução. */
  readonly card: BoardCard;
  readonly run: ProcessRun;
  /** Prefixo do código dos cards do quadro. */
  readonly keyPrefix: string;
  /** Por onde a situação da execução é entregue à página do diagrama; sem ela, a porta do navegador. */
  readonly store?: RunViewStore;
}

export interface RunDiagram {
  /** Endereço da página do diagrama desta execução. */
  readonly href: string;
  /** O quadro está sendo gravado no servidor, e o diagrama abre quando a gravação terminar. */
  readonly waiting: boolean;
  /** Por que o diagrama não abriu, em uma frase para a tela. */
  readonly failure: string | undefined;
  readonly onClick: (event: MouseEvent<HTMLAnchorElement>) => void;
  /** Clique do meio, que abre o endereço em outra aba sem passar por `onClick`. */
  readonly onAuxClick: () => void;
}

/**
 * O link "Ver diagrama" de uma execução. Antes de a página do diagrama abrir, a situação da execução é guardada pela
 * porta que as duas telas dividem. Com o quadro gravado num servidor, a página lê a situação de lá: o link espera a
 * gravação pendente terminar e só segue quando ela deu certo, para o diagrama não mostrar a etapa anterior.
 */
export function useRunDiagram(params: UseRunDiagramParams): RunDiagram {
  const { card, run, keyPrefix, store = BROWSER_STORE } = params;
  const { flush } = useProcessBoard();
  const [waiting, setWaiting] = useState(false);
  const [failure, setFailure] = useState<string>();
  /** A gravação pedida por um clique ainda não terminou. */
  const flushing = useRef(false);
  /** A gravação terminou bem: o próximo clique, feito por aqui mesmo, é o que segue para o diagrama. */
  const cleared = useRef(false);

  // NOTE: o quadro aberto está no endereço da página (`?quadro=<id>`); o painel do card só existe depois de montar no
  // navegador, então o endereço já está lá quando o link é desenhado.
  const boardId = readRequestedBoard() ?? DEFAULT_BOARD_ID;
  const ref = runViewRef({ boardId, cardId: card.id });
  const query = new URLSearchParams({ [REF_PARAM]: ref });

  function saveView(): boolean {
    const key = cardKey({ card, prefix: keyPrefix });
    return store.save({
      ref,
      definitionId: run.definitionId,
      version: run.version,
      processName: run.name,
      cardLabel: `${key} ${card.title}`,
      backHref: cardAddress(key),
      run,
      savedAt: new Date().toISOString(),
    });
  }

  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    if (cleared.current) {
      cleared.current = false;
      return;
    }
    const kept = saveView();
    if (flush === undefined) {
      if (kept) {
        setFailure(undefined);
        return;
      }
      event.preventDefault();
      setFailure(RUN_VIEW_REFUSED);
      return;
    }
    if (opensElsewhere(event)) {
      // NOTE: a outra aba abre sem esperar; o envio já sai, para a situação chegar ao servidor o quanto antes.
      void flush();
      return;
    }
    // WHY: o link só pode seguir depois da resposta do servidor, que chega fora deste clique; por isso o clique é
    // segurado aqui e refeito quando a gravação termina.
    event.preventDefault();
    if (flushing.current) {
      return;
    }
    flushing.current = true;
    setWaiting(true);
    setFailure(undefined);
    const link = event.currentTarget;
    void flush().then((status) => {
      flushing.current = false;
      setWaiting(false);
      if (status.kind !== 'saved') {
        // NOTE: o diagrama mostraria a situação antiga. O motivo e as saídas estão no aviso de gravação do quadro; aqui
        // fica só por que o link não abriu.
        setFailure(RUN_NOT_SAVED);
        return;
      }
      // NOTE: quem fechou o card enquanto esperava desistiu do diagrama; o link já não está na tela.
      if (link.isConnected) {
        cleared.current = true;
        link.click();
      }
    });
  }

  function onAuxClick() {
    saveView();
    void flush?.();
  }

  return {
    href: `${RUN_PAGE}?${query.toString()}`,
    waiting,
    failure,
    onClick,
    onAuxClick,
  };
}
