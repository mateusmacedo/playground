import Link from 'next/link';

import type { BoardRun, BoardRunStep } from '@/shared/process/board-runs';
import { runViewRef } from '@/shared/process/run-view-store';

import { runDiagramHref } from './run-links';

const moment = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

function progressText(run: BoardRun): string {
  const { done, total } = run.progress;
  return `${done} de ${total} ${total === 1 ? 'etapa' : 'etapas'}`;
}

interface CurrentStepsProps {
  readonly steps: readonly BoardRunStep[];
}

/** As etapas em que a execução está parada. A espera numa junção e o atraso vêm escritos, e não só na cor. */
function CurrentSteps({ steps }: Readonly<CurrentStepsProps>) {
  if (steps.length === 0) {
    return <span className="text-body-secondary">Sem etapa ativa</span>;
  }
  return (
    <ul className="list-unstyled mb-0">
      {steps.map((step) => (
        <li key={step.tokenId}>
          {step.label}
          {step.waiting && (
            <>
              {' '}
              <span className="badge border text-body">Em espera</span>
            </>
          )}
          {step.overdue && (
            <>
              {' '}
              <span className="badge text-bg-danger">Atrasada</span>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

export interface RunListTableProps {
  /** Execuções em andamento, já na ordem em que aparecem. */
  readonly runs: readonly BoardRun[];
}

/** Tabela das execuções em andamento, uma por linha, com o link do card no quadro e o do diagrama da execução. */
export function RunListTable({ runs }: Readonly<RunListTableProps>) {
  return (
    <div className="table-responsive">
      <table className="table table-hover align-middle mb-0">
        <caption className="visually-hidden">Execuções em andamento</caption>
        <thead>
          <tr>
            <th scope="col">Processo</th>
            <th scope="col">Card</th>
            <th scope="col">Quadro</th>
            <th scope="col">Etapa atual</th>
            <th scope="col">Progresso</th>
            <th scope="col">Início</th>
            <th scope="col">Diagrama</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={runViewRef(run.ref)}>
              <th className="fw-normal" scope="row">
                {run.processName}{' '}
                <span className="badge text-bg-secondary">
                  Versão {run.version}
                </span>
              </th>
              <td>
                <Link href={run.cardHref}>{run.cardLabel}</Link>
              </td>
              <td>{run.boardName}</td>
              <td>
                <CurrentSteps steps={run.steps} />
              </td>
              <td className="text-nowrap">{progressText(run)}</td>
              <td className="text-nowrap">
                <time dateTime={run.startedAt}>
                  {moment.format(new Date(run.startedAt))}
                </time>
              </td>
              <td>
                <Link
                  // NOTE: o nome diz de que card é o diagrama, para os links da coluna não soarem todos iguais.
                  aria-label={`Ver diagrama de ${run.cardLabel}`}
                  className="btn btn-sm btn-outline-primary text-nowrap"
                  href={runDiagramHref(run.ref)}
                >
                  Ver diagrama
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
