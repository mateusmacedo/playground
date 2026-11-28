'use client';

import { usePanelApi } from '@/shared/api/panel-api-context';
import { findVersion } from '@/shared/process/catalog';
import type { CatalogStore } from '@/shared/process/catalog-store';
import {
  BOARD_HREF,
  createBrowserRunViewStore,
  type RunViewStore,
} from '@/shared/process/run-view-store';
import { useProcessCatalog } from '@/shared/process/use-process-catalog';
import { LoadingState } from '@/shared/ui/states';

import { RemoteRunDiagram } from './remote-run-diagram';
import { RunSituation } from './run-situation';
import { RunUnavailable } from './run-unavailable';
import { useRunView } from './use-run-view';

const BROWSER_STORE = createBrowserRunViewStore();

export interface RunDiagramProps {
  /** Onde ler a situação da execução quando não há API; sem valor, o armazenamento do navegador. */
  readonly store?: RunViewStore;
  /** Onde ler o catálogo de processos quando não há API; sem valor, o armazenamento do navegador. */
  readonly catalogStore?: CatalogStore;
}

/**
 * Diagrama da execução com o que está no navegador: junta a situação que o quadro gravou com o desenho e o roteiro da
 * versão no catálogo. Sem referência, sem situação ou sem o desenho da versão, explica o que falta e oferece a volta.
 */
function LocalRunDiagram({
  store = BROWSER_STORE,
  catalogStore,
}: Readonly<RunDiagramProps>) {
  const reading = useRunView(store);
  const { catalog, loaded } = useProcessCatalog(catalogStore);

  if (reading.kind === 'pending' || !loaded) {
    return <LoadingState label="Carregando a execução…" rows={3} />;
  }
  if (reading.kind === 'no-ref') {
    return (
      <RunUnavailable
        message="Nenhuma execução foi indicada."
        detail="Abra o diagrama a partir de um card do quadro que tenha processo."
        backLabel="Voltar ao quadro"
        backHref={BOARD_HREF}
      />
    );
  }
  if (reading.kind === 'no-view') {
    return (
      <RunUnavailable
        message="A situação desta execução não está neste navegador."
        detail="O diagrama mostra a situação que o quadro grava ao abri-lo. Volte ao card e abra o diagrama de novo."
        backLabel="Voltar ao quadro"
        backHref={BOARD_HREF}
      />
    );
  }
  const { view } = reading;
  const version = findVersion({
    catalog,
    definitionId: view.definitionId,
    version: view.version,
  });
  if (version === undefined) {
    return (
      <RunUnavailable
        message={`O desenho da versão ${view.version} de ${view.processName} não está neste navegador.`}
        detail="O diagrama usa o desenho publicado, que fica guardado no navegador em que o processo foi publicado."
        backLabel="Voltar ao card"
        backHref={view.backHref}
      />
    );
  }
  return <RunSituation view={view} version={version} />;
}

/**
 * Diagrama da execução pedida no endereço (`?ref=<id do quadro>:<id do card>`). Com a API do painel, a situação e o
 * desenho vêm dela; sem a API, vêm do que o quadro e o editor gravaram neste navegador.
 */
export function RunDiagram(props: Readonly<RunDiagramProps>) {
  const api = usePanelApi();
  if (api !== null) {
    return <RemoteRunDiagram api={api} />;
  }
  return <LocalRunDiagram {...props} />;
}
