import { type RefObject, useEffect, useEffectEvent, useRef } from 'react';

import type { RunAction } from '@/shared/process/engine';
import type { ProcessRun } from '@/shared/process/run';

import type { BoardCommands } from './board-commands';
import type { Announce } from './board-notices';
import type { BoardCard, BoardProcess } from './model/board';
import { stepName } from './model/process-text';

/** Os comandos do quadro que o processo do card usa. */
export type ProcessCommands = Pick<
  BoardCommands,
  'startProcess' | 'advanceProcess' | 'removeProcess' | 'delegateStep'
>;

export interface AdvanceRequest {
  readonly action: RunAction;
  /** O que anunciar ao leitor de tela quando o processo aceitar a ação. */
  readonly announcement: string;
}

export interface DelegateRequest {
  /** Ficha parada na etapa que o card filho vai executar. */
  readonly tokenId: string;
  /** Nome da etapa, para o anúncio. */
  readonly stepLabel: string;
}

/** O que a pessoa faz no processo do card, já com quem age, o anúncio e o foco tratados. */
export interface CardProcessActions {
  /** Inicia o processo no card. Devolve o motivo da recusa, ou `undefined` quando iniciou. */
  readonly start: (process: BoardProcess) => string | undefined;
  /** Age numa etapa ou cancela o processo. Devolve o motivo da recusa, ou `undefined` quando o processo aceitou. */
  readonly advance: (request: AdvanceRequest) => string | undefined;
  /** Tira do card o processo que já acabou; recebe o nome dele, para o anúncio. */
  readonly remove: (processName: string) => void;
  /** Cria o card filho que vai executar a etapa. */
  readonly delegate: (request: DelegateRequest) => void;
}

export interface UseCardProcessParams {
  readonly card: BoardCard;
  readonly commands: ProcessCommands;
  /** Quem age: o mesmo nome que assina os comentários. */
  readonly by: string;
  /** Diz ao leitor de tela o que mudou, pelo mesmo caminho das outras mudanças do quadro. */
  readonly announce?: Announce;
}

export interface CardProcess {
  readonly actions: CardProcessActions;
  /** A seção do processo, para saber se o foco continua dentro dela. */
  readonly sectionRef: RefObject<HTMLElement | null>;
  /** O título da seção, que recebe o foco quando o controle acionado sai da tela. */
  readonly headingRef: RefObject<HTMLHeadingElement | null>;
  readonly focusHeading: () => void;
}

/**
 * Liga a seção do processo aos comandos do quadro: cada ação leva quem agiu, é anunciada ao leitor de tela e, quando o
 * botão acionado sai da tela (a etapa foi resolvida, o processo começou ou saiu do card), o foco vai para o título da
 * seção, em vez de se perder.
 */
export function useCardProcess(params: UseCardProcessParams): CardProcess {
  const { card, commands, by, announce } = params;
  const cardId = card.id;
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  /** Uma ação acabou de ser aceita: depois de a tela mudar, o foco precisa ser conferido. */
  const acted = useRef(false);

  function focusHeading() {
    headingRef.current?.focus();
  }

  useEffect(() => {
    if (!acted.current) {
      return;
    }
    acted.current = false;
    if (!sectionRef.current?.contains(document.activeElement)) {
      focusHeading();
    }
  });

  const run = card.process;
  const lastStatus = useRef(run?.status);
  const announceEnd = useEffectEvent((ended: ProcessRun) => {
    const outcome = ended.outcome?.label;
    announce?.(
      outcome
        ? `Processo ${ended.name} concluído: ${outcome}.`
        : `Processo ${ended.name} concluído.`,
    );
  });

  useEffect(() => {
    const before = lastStatus.current;
    lastStatus.current = run?.status;
    // NOTE: o processo termina sozinho quando a última etapa é resolvida; quem ouve precisa saber que ele acabou.
    if (run && before === 'running' && run.status === 'completed') {
      announceEnd(run);
    }
  }, [run]);

  function accepted(announcement: string) {
    acted.current = true;
    announce?.(announcement);
  }

  return {
    sectionRef,
    headingRef,
    focusHeading,
    actions: {
      start(process) {
        const refusal = commands.startProcess({ cardId, process, by });
        if (refusal === undefined) {
          accepted(`Processo ${process.name} iniciado no card ${card.title}.`);
        }
        return refusal;
      },
      advance(request) {
        const { action, announcement } = request;
        const refusal = commands.advanceProcess({ cardId, action, by });
        if (refusal === undefined) {
          accepted(announcement);
        }
        return refusal;
      },
      remove(processName) {
        commands.removeProcess(cardId);
        accepted(`Processo ${processName} removido do card.`);
      },
      delegate(request) {
        const { tokenId, stepLabel } = request;
        const childId = commands.delegateStep({ cardId, tokenId, by });
        if (childId !== undefined) {
          accepted(`Card filho criado para a etapa ${stepName(stepLabel)}.`);
        }
      },
    },
  };
}
