import { type RefObject, useId, useRef, useState } from 'react';

import type { CatalogStore } from '@/shared/process/catalog-store';

import type { Announce } from '../board-notices';
import type { Board, BoardCard, CardLocation } from '../model/board';
import { PLAN_MISSING } from '../model/process-run';
import { processSummary } from '../model/process-summary';
import {
  type CardProcessActions,
  type ProcessCommands,
  useCardProcess,
} from '../use-card-process';
import { useProcessBoard } from '../use-process-board';
import { ProcessCancelDialog } from './process-cancel-dialog';
import { ProcessEnded } from './process-ended';
import { ProcessRunning } from './process-running';
import { ProcessStart } from './process-start';

interface ProcessStateProps {
  readonly card: BoardCard;
  readonly board: Board;
  readonly actions: CardProcessActions;
  readonly onOpenCard: (cardId: string) => void;
  readonly onRequestCancel: () => void;
  readonly cancelRef: RefObject<HTMLButtonElement | null>;
  readonly catalogStore?: CatalogStore;
}

/** O conteúdo da seção conforme a situação: sem processo, em andamento ou encerrado. */
function ProcessState({
  card,
  board,
  actions,
  onOpenCard,
  onRequestCancel,
  cancelRef,
  catalogStore,
}: Readonly<ProcessStateProps>) {
  const { now } = useProcessBoard();
  const run = card.process;
  const keyPrefix = board.config.keyPrefix;

  if (!run) {
    return (
      <div className="d-grid gap-2">
        <p className="small text-body-secondary mb-0">
          Este card não segue nenhum processo.
        </p>
        <ProcessStart
          actions={actions}
          openLabel="Escolher processo"
          catalogStore={catalogStore}
        />
      </div>
    );
  }
  const summary = processSummary({ board, card, now });
  if (run.status === 'running' && summary) {
    return (
      <ProcessRunning
        card={card}
        run={run}
        summary={summary}
        lanes={board.lanes}
        doneLaneId={board.config.doneLaneId}
        keyPrefix={keyPrefix}
        actions={actions}
        onOpenCard={onOpenCard}
        onRequestCancel={onRequestCancel}
        cancelRef={cancelRef}
        catalogStore={catalogStore}
      />
    );
  }
  return (
    <ProcessEnded
      card={card}
      run={run}
      keyPrefix={keyPrefix}
      actions={actions}
      // NOTE: em andamento e sem resumo, o quadro perdeu o roteiro da execução, e ela não tem como andar.
      stuck={run.status === 'running' ? PLAN_MISSING : undefined}
      catalogStore={catalogStore}
    />
  );
}

export interface ProcessSectionProps {
  readonly location: CardLocation;
  readonly board: Board;
  readonly commands: ProcessCommands;
  /** Quem age no processo: o mesmo nome que assina os comentários. */
  readonly author: string;
  readonly onOpenCard: (cardId: string) => void;
  /** Diz ao leitor de tela o que uma ação mudou no processo. */
  readonly onAnnounce?: Announce;
  /** Onde o catálogo de processos é lido; sem ele, o do painel. */
  readonly catalogStore?: CatalogStore;
}

/**
 * Seção "Processo" do painel do card: sem processo, a escolha de um para seguir; com o processo em andamento, as
 * etapas ativas e o que fazer em cada uma; com o processo encerrado, o desfecho e a trilha.
 */
export function ProcessSection({
  location,
  board,
  commands,
  author,
  onOpenCard,
  onAnnounce,
  catalogStore,
}: Readonly<ProcessSectionProps>) {
  const headingId = useId();
  const { card } = location;
  const process = useCardProcess({
    card,
    commands,
    by: author,
    announce: onAnnounce,
  });
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [cancelling, setCancelling] = useState(false);
  const run = card.process;

  function cancel(processName: string) {
    setCancelling(false);
    process.actions.advance({
      action: { kind: 'cancel' },
      announcement: `Processo ${processName} cancelado.`,
    });
  }

  return (
    <section
      ref={process.sectionRef}
      aria-labelledby={headingId}
      className="kanban-process"
    >
      <h3 id={headingId} ref={process.headingRef} tabIndex={-1} className="h6">
        Processo
      </h3>
      <ProcessState
        card={card}
        board={board}
        actions={process.actions}
        onOpenCard={onOpenCard}
        onRequestCancel={() => setCancelling(true)}
        cancelRef={cancelRef}
        catalogStore={catalogStore}
      />
      {run ? (
        <ProcessCancelDialog
          visible={cancelling}
          processName={run.name}
          onConfirm={() => cancel(run.name)}
          onDismiss={() => setCancelling(false)}
          // NOTE: quem desistiu volta ao botão; depois do cancelamento o botão já saiu da tela, e o foco vai para o
          // título da seção.
          onClosed={() =>
            (cancelRef.current ?? process.headingRef.current)?.focus()
          }
        />
      ) : null}
    </section>
  );
}
