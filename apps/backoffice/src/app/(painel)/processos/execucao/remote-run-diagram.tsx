import type { PanelApi } from '@/shared/api/panel-api';
import { BOARD_HREF } from '@/shared/process/run-view-store';
import { ErrorState, LoadingState } from '@/shared/ui/states';

import { RunSituation } from './run-situation';
import { RunUnavailable } from './run-unavailable';
import { useRemoteRun } from './use-remote-run';

export interface RemoteRunDiagramProps {
  readonly api: PanelApi;
}

/**
 * Diagrama da execução pedida no endereço, com a situação lida da API do painel: o quadro dá o card e a execução, e a
 * definição do processo dá o desenho da versão. Enquanto lê, mostra o carregamento; quando a leitura falha, oferece a
 * nova tentativa; e sem o quadro, o card, o processo do card ou o desenho, explica o que falta e oferece a volta.
 */
export function RemoteRunDiagram({ api }: Readonly<RemoteRunDiagramProps>) {
  const { reading, retry } = useRemoteRun(api);

  switch (reading.kind) {
    case 'pending':
      return <LoadingState label="Carregando a execução…" rows={3} />;
    case 'failed':
      return (
        <ErrorState
          message="Não foi possível carregar a execução."
          detail={reading.message}
          onRetry={retry}
        />
      );
    case 'no-ref':
      return (
        <RunUnavailable
          message="Nenhuma execução foi indicada."
          detail="Abra o diagrama a partir de um card do quadro que tenha processo."
          backLabel="Voltar ao quadro"
          backHref={BOARD_HREF}
        />
      );
    case 'no-board':
      return (
        <RunUnavailable
          message="O quadro desta execução não foi encontrado."
          detail="Ele pode ter sido removido. Abra o diagrama a partir de um card do quadro que tenha processo."
          backLabel="Voltar ao quadro"
          backHref={BOARD_HREF}
        />
      );
    case 'no-card':
      return (
        <RunUnavailable
          message="O card desta execução não está mais no quadro."
          detail="Ele pode ter sido removido. Volte ao quadro e abra o diagrama a partir de outro card."
          backLabel="Voltar ao quadro"
          backHref={reading.boardHref}
        />
      );
    case 'no-run':
      return (
        <RunUnavailable
          message={`O card ${reading.cardLabel} não tem processo em execução.`}
          detail="O processo pode ter sido removido do card depois que o diagrama foi aberto."
          backLabel="Voltar ao card"
          backHref={reading.backHref}
        />
      );
    case 'no-version':
      return (
        <RunUnavailable
          message={`O desenho da versão ${reading.view.version} de ${reading.view.processName} não está no servidor.`}
          detail="O diagrama usa o desenho publicado, que fica guardado com o processo no servidor."
          backLabel="Voltar ao card"
          backHref={reading.view.backHref}
        />
      );
    case 'ready':
      return <RunSituation view={reading.view} version={reading.version} />;
  }
}
