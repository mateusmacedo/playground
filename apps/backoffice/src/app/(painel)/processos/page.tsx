import type { Metadata } from 'next';

import { sampleProcess } from './model/sample-process';
import { ProcessEditor } from './process-editor';

export const metadata: Metadata = { title: 'Processos' };

export default function ProcessesPage() {
  return (
    <div className="card mb-4 page-fill">
      <div className="card-body process-page__body">
        <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
          <h1 className="h4 mb-0">Editor de processos</h1>
          <span className="badge text-bg-info">Beta</span>
          <span className="small text-body-secondary">
            Em teste: pode mudar, e o processo não é gravado.
          </span>
        </div>
        <p className="small text-body-secondary">
          Monte o processo arrastando blocos da biblioteca para o canvas e
          ligando a saída de um bloco à entrada de outro.
        </p>
        <ProcessEditor initial={sampleProcess} />
      </div>
    </div>
  );
}
