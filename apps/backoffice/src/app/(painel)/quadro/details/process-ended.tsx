import { CButton } from '@coreui/react';

import type { CatalogStore } from '@/shared/process/catalog-store';
import type { ProcessRun } from '@/shared/process/run';

import type { BoardCard } from '../model/board';
import type { CardProcessActions } from '../use-card-process';
import { ProcessDiagramLink } from './process-diagram-link';
import { ProcessHeading } from './process-heading';
import { ProcessMoment } from './process-moment';
import { ProcessStart } from './process-start';
import { ProcessTrail } from './process-trail';

export interface ProcessEndedProps {
  /** Card dono do processo. */
  readonly card: BoardCard;
  readonly run: ProcessRun;
  /** Prefixo do código dos cards do quadro. */
  readonly keyPrefix: string;
  readonly actions: CardProcessActions;
  /** Por que a execução não tem como andar, quando ela não acabou mas ficou sem o roteiro. */
  readonly stuck?: string;
  readonly catalogStore?: CatalogStore;
}

/**
 * Processo que não anda mais no card: concluído, cancelado ou sem o roteiro. Mostra como acabou e a trilha do que
 * aconteceu, e deixa tirar o processo do card ou começar outro, que toma o lugar dele.
 */
export function ProcessEnded({
  card,
  run,
  keyPrefix,
  actions,
  stuck,
  catalogStore,
}: Readonly<ProcessEndedProps>) {
  return (
    <div className="d-grid gap-2">
      <div>
        <ProcessHeading run={run} />
        {stuck ? (
          <p role="alert" className="small text-danger mb-0">
            {stuck}
          </p>
        ) : null}
        {run.outcome ? (
          <p className="small mb-0">Desfecho: {run.outcome.label}</p>
        ) : null}
        {run.endedAt ? (
          <p className="small text-body-secondary mb-0">
            Encerrado em <ProcessMoment at={run.endedAt} />
          </p>
        ) : null}
      </div>
      <ProcessDiagramLink card={card} run={run} keyPrefix={keyPrefix} />
      <ProcessTrail log={run.log} open />
      <div>
        <CButton
          type="button"
          color="danger"
          variant="outline"
          size="sm"
          onClick={() => actions.remove(run.name)}
        >
          Remover processo
        </CButton>
      </div>
      {/* NOTE: a execução sem roteiro ainda conta como em andamento; outro processo só começa depois de ela sair. */}
      {stuck ? null : (
        <ProcessStart
          actions={actions}
          openLabel="Iniciar outro processo"
          catalogStore={catalogStore}
        />
      )}
    </div>
  );
}
