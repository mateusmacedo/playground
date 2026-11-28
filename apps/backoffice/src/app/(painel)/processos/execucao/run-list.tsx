'use client';

import { CAlert, CButton } from '@coreui/react';
import Link from 'next/link';

import { BOARD_HREF } from '@/shared/process/run-view-store';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/states';

import { RunListTable } from './run-list-table';
import { useBoardRuns } from './use-board-runs';

interface IncompleteNoticeProps {
  /** Nomes dos quadros que não deu para ler. */
  readonly boards: readonly string[];
  readonly onRetry: () => void;
}

/** Algum quadro não pôde ser lido: a lista mostra os outros, e o aviso diz que ela pode estar incompleta. */
function IncompleteNotice({
  boards,
  onRetry,
}: Readonly<IncompleteNoticeProps>) {
  const names = boards.join(', ');
  const subject = boards.length === 1 ? 'o quadro' : 'os quadros';
  return (
    <CAlert
      className="d-flex flex-wrap align-items-center gap-2 py-2 small"
      color="warning"
    >
      <span>
        {`Não foi possível ler ${subject} ${names}. A lista pode estar incompleta.`}
      </span>
      <CButton
        className="ms-auto"
        color="secondary"
        onClick={onRetry}
        size="sm"
        type="button"
        variant="outline"
      >
        Tentar de novo
      </CButton>
    </CAlert>
  );
}

/**
 * Lista das execuções em andamento dos cards de todos os quadros. Enquanto lê, mostra o carregamento; quando a leitura
 * falha, oferece a nova tentativa; e sem nenhuma execução, diz como começar uma.
 */
export function RunList() {
  const { reading, retry } = useBoardRuns();

  if (reading.kind === 'pending') {
    return <LoadingState label="Carregando as execuções…" rows={3} />;
  }
  if (reading.kind === 'failed') {
    return (
      <ErrorState
        message="Não foi possível carregar as execuções."
        detail={reading.message}
        onRetry={retry}
      />
    );
  }
  return (
    // WHY: a página ocupa a altura da janela; a lista comprida rola aqui dentro, e não empurra o rodapé.
    <div className="overflow-auto">
      {reading.unreadBoards.length > 0 && (
        <IncompleteNotice boards={reading.unreadBoards} onRetry={retry} />
      )}
      {reading.runs.length === 0 ? (
        <EmptyState message="Nenhuma execução em andamento.">
          <p className="small mb-2">
            Para começar uma, abra um card do quadro e inicie um processo nele.
          </p>
          <Link className="btn btn-outline-primary" href={BOARD_HREF}>
            Ir para o quadro
          </Link>
        </EmptyState>
      ) : (
        <RunListTable runs={reading.runs} />
      )}
    </div>
  );
}
