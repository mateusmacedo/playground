import Link from 'next/link';
import { useMemo } from 'react';

import type { ProcessVersion } from '@/shared/process/catalog';
import { stepStates } from '@/shared/process/engine-states';
import type { RunStatus } from '@/shared/process/run';
import type { RunView } from '@/shared/process/run-view-store';

import { ProcessRunViewer } from '../viewer/process-run-viewer';

const moment = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

const STATUS_TEXT: Readonly<Record<RunStatus, string>> = {
  running: 'Em andamento',
  completed: 'Concluída',
  cancelled: 'Cancelada',
};

export interface RunSituationProps {
  readonly view: RunView;
  /** Versão do processo em que a execução começou, com o desenho e o roteiro dela. */
  readonly version: ProcessVersion;
}

/** A situação de uma execução sobre o desenho da versão: de que processo e card ela é, de quando, e o diagrama. */
export function RunSituation({ view, version }: Readonly<RunSituationProps>) {
  const { states, takenExits } = useMemo(
    () => stepStates({ plan: version.plan, run: view.run }),
    [version.plan, view.run],
  );

  return (
    <div className="process-run">
      <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
        <h2 className="h5 mb-0">{view.processName}</h2>
        <span className="badge text-bg-secondary">Versão {view.version}</span>
        <span className="badge border text-body">
          {STATUS_TEXT[view.run.status]}
        </span>
      </div>
      <p className="small text-body-secondary mb-2">
        Card <strong>{view.cardLabel}</strong>. Situação em{' '}
        <time dateTime={view.savedAt}>
          {moment.format(new Date(view.savedAt))}
        </time>
        . <Link href={view.backHref}>Voltar ao card</Link>
      </p>
      <ProcessRunViewer
        documentText={version.documentText}
        states={states}
        takenExits={takenExits}
      />
    </div>
  );
}
