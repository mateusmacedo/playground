import Link from 'next/link';

import type { ProcessRun } from '@/shared/process/run';
import type { RunViewStore } from '@/shared/process/run-view-store';

import type { BoardCard } from '../model/board';
import { useRunDiagram } from '../use-run-diagram';

export interface ProcessDiagramLinkProps {
  /** Card dono da execução. */
  readonly card: BoardCard;
  readonly run: ProcessRun;
  /** Prefixo do código dos cards do quadro. */
  readonly keyPrefix: string;
  /** Por onde a situação da execução é entregue à página do diagrama; sem ela, a porta do navegador. */
  readonly store?: RunViewStore;
}

/**
 * Link "Ver diagrama": abre a página que desenha o processo com a etapa atual marcada. O diagrama mora em outra rota,
 * então aqui só fica o link; a entrega da situação da execução e a espera pela gravação estão em `useRunDiagram`.
 */
export function ProcessDiagramLink({
  card,
  run,
  keyPrefix,
  store,
}: Readonly<ProcessDiagramLinkProps>) {
  const diagram = useRunDiagram({ card, run, keyPrefix, store });

  return (
    <div>
      <Link
        href={diagram.href}
        // NOTE: a página do diagrama é pesada e rara; o painel do card não a busca antes do clique.
        prefetch={false}
        aria-disabled={diagram.waiting ? true : undefined}
        onClick={diagram.onClick}
        onAuxClick={diagram.onAuxClick}
      >
        Ver diagrama
      </Link>
      <output className="small text-body-secondary ms-2">
        {diagram.waiting ? 'Gravando o quadro antes de abrir…' : null}
      </output>
      {diagram.failure ? (
        <p role="alert" className="small text-danger mb-0">
          {diagram.failure}
        </p>
      ) : null}
    </div>
  );
}
