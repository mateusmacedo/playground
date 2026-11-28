import { CFormSelect } from '@coreui/react';
import { useId, useState } from 'react';

import { EmptyState } from '@/shared/ui/states';

import type { Board } from './model/board';
import { type PendingStep, pendingSteps } from './model/pending-steps';
import { ALL_ROLES, roleOptions, stepMatchesRole } from './pending-steps-roles';
import { PendingStepsTable } from './pending-steps-table';
import type { BoardFilter } from './use-board-filter';

function plural(count: number): string {
  return count === 1 ? 'etapa pendente' : 'etapas pendentes';
}

interface SummaryParams {
  readonly shown: readonly PendingStep[];
  readonly total: number;
}

/** Quantas etapas a tabela mostra, de quantas o quadro tem, e quantas delas passaram do prazo. */
function summaryText(params: SummaryParams): string {
  const { shown, total } = params;
  const count =
    shown.length === total
      ? `${total} ${plural(total)}`
      : `${shown.length} de ${total} ${plural(total)}`;
  const overdue = shown.filter((step) => step.overdue).length;
  if (overdue === 0) {
    return count;
  }
  return `${count}, ${overdue} ${overdue === 1 ? 'atrasada' : 'atrasadas'}`;
}

export interface PendingStepsViewProps {
  readonly board: Board;
  /** A busca e os filtros da barra do quadro, que valem pelo card dono da etapa. */
  readonly filter: Pick<BoardFilter, 'filtering' | 'matches'>;
  /** A página já montou no navegador; antes disso não há relógio, e nenhuma etapa conta como atrasada. */
  readonly isClient: boolean;
  readonly onOpen: (cardId: string) => void;
}

/**
 * Visão "Etapas": as etapas dos processos dos cards que esperam uma ação, da que vence primeiro para a última, com o
 * filtro por papel. A busca e os filtros da barra do quadro valem aqui pelo card dono da etapa.
 */
export function PendingStepsView({
  board,
  filter,
  isClient,
  onOpen,
}: Readonly<PendingStepsViewProps>) {
  const roleId = useId();
  const [role, setRole] = useState(ALL_ROLES);
  const now = isClient ? new Date().toISOString() : undefined;
  const all = pendingSteps({ board, now });

  if (all.length === 0) {
    return (
      <EmptyState message="Nenhuma etapa pendente no quadro.">
        <p className="small mb-0">
          As etapas dos processos em andamento nos cards aparecem aqui.
        </p>
      </EmptyState>
    );
  }

  const roles = roleOptions(all);
  // NOTE: o papel escolhido some do filtro quando a última etapa dele é resolvida.
  const chosen = roles.some((option) => option.value === role)
    ? role
    : ALL_ROLES;
  const shown = all.filter(
    (step) =>
      stepMatchesRole({ step, value: chosen }) &&
      (!filter.filtering || filter.matches(step.card)),
  );

  return (
    <div>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
        <label htmlFor={roleId} className="small mb-0">
          Papel
        </label>
        <CFormSelect
          id={roleId}
          size="sm"
          className="w-auto"
          value={chosen}
          onChange={(event) => setRole(event.target.value)}
        >
          {roles.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </CFormSelect>
        <span className="small text-body-secondary" aria-live="polite">
          {summaryText({ shown, total: all.length })}
        </span>
      </div>
      {shown.length > 0 ? (
        <PendingStepsTable
          steps={shown}
          keyPrefix={board.config.keyPrefix}
          onOpen={onOpen}
        />
      ) : (
        <EmptyState message="Nenhuma etapa pendente com os filtros escolhidos." />
      )}
    </div>
  );
}
