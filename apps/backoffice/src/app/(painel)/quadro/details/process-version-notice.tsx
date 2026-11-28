import type { CatalogStore } from '@/shared/process/catalog-store';
import type { ProcessRun } from '@/shared/process/run';
import { useProcessCatalog } from '@/shared/process/use-process-catalog';

import { newerVersion } from '../model/process-versions';

export interface ProcessVersionNoticeProps {
  readonly run: Pick<ProcessRun, 'definitionId' | 'version'>;
  /** Onde o catálogo de processos é lido; sem ele, o do painel. */
  readonly catalogStore?: CatalogStore;
}

/**
 * Avisa que o processo ganhou uma versão mais nova depois que a execução começou. A execução não muda de versão: o
 * aviso só explica por que o card segue um desenho diferente do publicado. Sem o catálogo lido, não mostra nada.
 */
export function ProcessVersionNotice({
  run,
  catalogStore,
}: Readonly<ProcessVersionNoticeProps>) {
  const { catalog, loaded } = useProcessCatalog(catalogStore);
  const newer = loaded ? newerVersion({ catalog, run }) : undefined;
  if (newer === undefined) {
    return null;
  }
  return (
    <p className="small text-body-secondary mb-2">
      A versão {newer} deste processo já foi publicada. Este card continua na
      versão {run.version}, em que o processo começou.
    </p>
  );
}
