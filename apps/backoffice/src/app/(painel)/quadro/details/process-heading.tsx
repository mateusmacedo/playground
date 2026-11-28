import type { RunProgress } from '@/shared/process/engine-progress';
import type { ProcessRun, RunStatus } from '@/shared/process/run';

import { runStatusText } from '../model/process-text';

const STATUS_STYLE: Readonly<Record<RunStatus, string>> = {
  running: 'text-bg-info',
  completed: 'text-bg-success',
  cancelled: 'text-bg-secondary',
};

export interface ProcessHeadingProps {
  readonly run: Pick<ProcessRun, 'name' | 'version' | 'status'>;
}

/** Qual processo o card segue, em que versão e em que situação. */
export function ProcessHeading({ run }: Readonly<ProcessHeadingProps>) {
  return (
    <p className="d-flex flex-wrap align-items-baseline gap-2 mb-2">
      <strong>{run.name}</strong>
      <span className="small text-body-secondary">versão {run.version}</span>
      <span className={`badge ${STATUS_STYLE[run.status]}`}>
        {runStatusText(run.status)}
      </span>
    </p>
  );
}

/** Andamento em palavras: quantas etapas já foram feitas, de quantas. */
export function progressLabel(progress: RunProgress): string {
  const { done, total } = progress;
  const steps = total === 1 ? 'etapa feita' : 'etapas feitas';
  return `${done} de ${total} ${steps}`;
}

export interface ProcessProgressProps {
  readonly progress: RunProgress;
}

/** Barra do andamento do processo, com o mesmo número escrito ao lado. */
export function ProcessProgress({ progress }: Readonly<ProcessProgressProps>) {
  const { done, total } = progress;
  const label = progressLabel(progress);

  return (
    <div className="d-flex align-items-center gap-2 mb-2">
      {/* NOTE: a barra nativa já tem o papel e os valores; o `CProgress` não deixa nomear o elemento que tem o papel. */}
      <progress
        className="kanban-process__progress flex-grow-1"
        aria-label="Andamento do processo"
        aria-valuetext={label}
        value={done}
        // NOTE: o processo sem etapa que espere alguém tem total zero, que a barra não aceita como máximo.
        max={Math.max(total, 1)}
      />
      <span className="small text-nowrap">{label}</span>
    </div>
  );
}
