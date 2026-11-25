import type { Metadata } from 'next';

import { sampleProcess } from './model/sample-process';
import { ProcessEditor } from './process-editor';

export const metadata: Metadata = { title: 'Processos' };

export default function ProcessesPage() {
  return (
    <div className="card mb-4">
      <div className="card-body">
        <h1 className="h4">Editor de processos</h1>
        <p className="small text-body-secondary">
          Monte o processo arrastando blocos da biblioteca para o canvas e
          ligando a saída de um bloco à entrada de outro.
        </p>
        <ProcessEditor initial={sampleProcess} />
      </div>
    </div>
  );
}
