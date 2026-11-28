import { CButton } from '@coreui/react';
import type { RefObject } from 'react';

import type { CatalogStore } from '@/shared/process/catalog-store';
import type { ProcessRun } from '@/shared/process/run';

import type { BoardCard, BoardLane } from '../model/board';
import type { ProcessSummary } from '../model/process-summary';
import type { CardProcessActions } from '../use-card-process';
import { ProcessDiagramLink } from './process-diagram-link';
import { ProcessHeading, ProcessProgress } from './process-heading';
import { ProcessStep } from './process-step';
import { ProcessTrail } from './process-trail';
import { ProcessVersionNotice } from './process-version-notice';

export interface ProcessRunningProps {
  /** Card dono do processo. */
  readonly card: BoardCard;
  readonly run: ProcessRun;
  readonly summary: ProcessSummary;
  readonly lanes: readonly BoardLane[];
  /** Coluna de conclusão do quadro, quando ele tem uma. */
  readonly doneLaneId: string | undefined;
  /** Prefixo do código dos cards do quadro. */
  readonly keyPrefix: string;
  readonly actions: CardProcessActions;
  readonly onOpenCard: (cardId: string) => void;
  /** A pessoa pediu para cancelar; quem confirma é a janela da seção. */
  readonly onRequestCancel: () => void;
  /** O botão "Cancelar processo", para o foco voltar a ele quando a pessoa desiste. */
  readonly cancelRef: RefObject<HTMLButtonElement | null>;
  readonly catalogStore?: CatalogStore;
}

/**
 * Processo em andamento no card: qual é, quanto já andou, as etapas em que está parado, com o que cada uma pede e
 * aceita, o diagrama, a trilha do que já aconteceu e o cancelamento.
 */
export function ProcessRunning({
  card,
  run,
  summary,
  lanes,
  doneLaneId,
  keyPrefix,
  actions,
  onOpenCard,
  onRequestCancel,
  cancelRef,
  catalogStore,
}: Readonly<ProcessRunningProps>) {
  return (
    <div className="d-grid gap-2">
      <div>
        <ProcessHeading run={run} />
        <ProcessProgress progress={summary.progress} />
        <ProcessVersionNotice run={run} catalogStore={catalogStore} />
      </div>
      {summary.steps.length > 0 ? (
        <ul
          className="list-unstyled d-grid gap-2 mb-0"
          aria-label="Etapas em andamento"
        >
          {summary.steps.map((step) => (
            <ProcessStep
              key={step.active.token.id}
              step={step}
              lanes={lanes}
              doneLaneId={doneLaneId}
              actions={actions}
              onOpenCard={onOpenCard}
            />
          ))}
        </ul>
      ) : (
        <p className="small text-body-secondary mb-0">
          Nenhuma etapa à espera de ação.
        </p>
      )}
      <ProcessDiagramLink card={card} run={run} keyPrefix={keyPrefix} />
      <ProcessTrail log={run.log} />
      <div>
        <CButton
          ref={cancelRef}
          type="button"
          color="danger"
          variant="outline"
          size="sm"
          onClick={onRequestCancel}
        >
          Cancelar processo
        </CButton>
      </div>
    </div>
  );
}
