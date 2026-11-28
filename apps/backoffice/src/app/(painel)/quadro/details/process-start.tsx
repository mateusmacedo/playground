import { CButton, CFormSelect } from '@coreui/react';
import Link from 'next/link';
import { useId, useRef, useState } from 'react';

import type { CatalogStore } from '@/shared/process/catalog-store';
import { useProcessCatalog } from '@/shared/process/use-process-catalog';

import { startableProcesses } from '../model/process-versions';
import type { CardProcessActions } from '../use-card-process';

/** Endereço do editor de processos, onde os processos são desenhados e publicados. */
const PROCESS_EDITOR_HREF = '/processos';

interface ProcessPickerProps {
  readonly actions: Pick<CardProcessActions, 'start'>;
  /** Leva o foco ao botão que abriu a escolha. */
  readonly onFocusOpener: () => void;
  readonly catalogStore?: CatalogStore;
}

/**
 * A escolha do processo a seguir, entre os publicados do catálogo, cada um na última versão. Mostra a espera da
 * leitura, a falha dela com nova tentativa e o catálogo sem processo publicado, com o caminho para o editor.
 */
function ProcessPicker({
  actions,
  onFocusOpener,
  catalogStore,
}: Readonly<ProcessPickerProps>) {
  const catalog = useProcessCatalog(catalogStore);
  const selectId = useId();
  const [chosenId, setChosenId] = useState('');
  const [refusal, setRefusal] = useState<string>();

  function retry() {
    // WHY: o botão da nova tentativa sai da tela enquanto a leitura corre; sem isto o foco se perderia.
    onFocusOpener();
    void catalog.reload();
  }

  if (!catalog.loaded && catalog.loadFailure) {
    return (
      <div role="alert" className="small">
        <p className="mb-1">
          Não foi possível carregar os processos. {catalog.loadFailure.message}
        </p>
        <CButton
          type="button"
          color="primary"
          variant="outline"
          size="sm"
          disabled={catalog.loading}
          onClick={retry}
        >
          Tentar de novo
        </CButton>
      </div>
    );
  }
  if (!catalog.loaded) {
    return (
      <output className="d-block small text-body-secondary">
        Carregando os processos…
      </output>
    );
  }

  const processes = startableProcesses(catalog.catalog);
  // NOTE: sem escolha feita, vale o primeiro da lista, que é o que o campo mostra.
  const chosen =
    processes.find((process) => process.definitionId === chosenId) ??
    processes.at(0);
  if (!chosen) {
    return (
      <p className="small mb-0">
        Nenhum processo publicado ainda. Desenhe e publique um processo para os
        cards poderem segui-lo.{' '}
        <Link href={PROCESS_EDITOR_HREF}>Abrir o editor de processos</Link>
      </p>
    );
  }

  return (
    <div className="d-grid gap-2">
      <CFormSelect
        id={selectId}
        label="Processo"
        size="sm"
        value={chosen.definitionId}
        onChange={(event) => setChosenId(event.target.value)}
      >
        {processes.map((process) => (
          <option key={process.definitionId} value={process.definitionId}>
            {process.name} (versão {process.version})
          </option>
        ))}
      </CFormSelect>
      {refusal ? (
        <p role="alert" className="small text-danger mb-0">
          {refusal}
        </p>
      ) : null}
      <div>
        <CButton
          type="button"
          color="primary"
          size="sm"
          onClick={() => setRefusal(actions.start(chosen))}
        >
          Iniciar processo
        </CButton>
      </div>
    </div>
  );
}

export interface ProcessStartProps {
  readonly actions: Pick<CardProcessActions, 'start'>;
  /** O que o botão que abre a escolha diz. */
  readonly openLabel: string;
  /** Onde o catálogo de processos é lido; sem ele, o do painel. */
  readonly catalogStore?: CatalogStore;
}

/**
 * Início de um processo no card. A lista de processos só é lida quando a pessoa pede para escolher: ler o catálogo
 * inteiro a cada card aberto pesaria no painel, e a maioria dos cards é aberta para outra coisa.
 */
export function ProcessStart({
  actions,
  openLabel,
  catalogStore,
}: Readonly<ProcessStartProps>) {
  const panelId = useId();
  const openerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  return (
    <div className="d-grid gap-2">
      <div>
        <CButton
          ref={openerRef}
          type="button"
          color="secondary"
          variant="outline"
          size="sm"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(!open)}
        >
          {openLabel}
        </CButton>
      </div>
      <div id={panelId} hidden={!open}>
        {open ? (
          <ProcessPicker
            actions={actions}
            onFocusOpener={() => openerRef.current?.focus()}
            catalogStore={catalogStore}
          />
        ) : null}
      </div>
    </div>
  );
}
