import type { Metadata } from 'next';

import { appConfig } from '@/core/config/app-config';

import { sampleProcess } from './model/sample-process';
import { ProcessWorkspace } from './process-workspace';
import { storagePlace } from './storage-place';

export const metadata: Metadata = { title: 'Processos' };

export default function ProcessesPage() {
  const place = storagePlace(appConfig.apiBaseUrl !== null);
  return (
    <div className="card mb-4 page-fill">
      <div className="card-body process-page__body">
        <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
          <h1 className="h4 mb-0">Editor de processos</h1>
          <span className="badge text-bg-info">Beta</span>
          <span className="small text-body-secondary">
            {`Em teste: pode mudar. O rascunho fica salvo ${place}.`}
          </span>
        </div>
        <p className="small text-body-secondary">
          Monte o processo arrastando blocos da biblioteca para o canvas e
          ligando a saída de um bloco à entrada de outro.
        </p>
        <ProcessWorkspace sample={sampleProcess} />
      </div>
    </div>
  );
}
