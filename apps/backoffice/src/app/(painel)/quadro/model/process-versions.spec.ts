import type { ProcessCatalog } from '@/shared/process/catalog';
import {
  testDefinition,
  testPlan,
  testVersion,
} from '@/shared/process/catalog-test-data';

import { newerVersion, startableProcesses } from './process-versions';

const catalog: ProcessCatalog = {
  definitions: [
    testDefinition({
      id: 'published',
      name: 'Atendimento',
      versions: [testVersion(1), testVersion(2)],
    }),
    testDefinition({ id: 'draft', name: 'Só rascunho' }),
    testDefinition({
      id: 'archived',
      name: 'Arquivado',
      versions: [testVersion(3)],
      archived: true,
    }),
  ],
};

describe('startableProcesses', () => {
  it('oferece só os processos publicados e não arquivados, na última versão, com o roteiro dela', () => {
    expect(startableProcesses(catalog)).toEqual([
      {
        definitionId: 'published',
        version: 2,
        name: 'Atendimento',
        plan: testPlan,
      },
    ]);
  });

  it('não oferece nada com o catálogo vazio', () => {
    expect(startableProcesses({ definitions: [] })).toEqual([]);
  });
});

describe('newerVersion', () => {
  it('devolve a última versão quando a execução começou numa anterior', () => {
    const run = { definitionId: 'published', version: 1 };

    expect(newerVersion({ catalog, run })).toBe(2);
  });

  it('não devolve nada quando a execução já está na última versão', () => {
    const run = { definitionId: 'published', version: 2 };

    expect(newerVersion({ catalog, run })).toBeUndefined();
  });

  it('não devolve nada para o processo arquivado, sem versão ou fora do catálogo', () => {
    expect(
      newerVersion({ catalog, run: { definitionId: 'archived', version: 1 } }),
    ).toBeUndefined();
    expect(
      newerVersion({ catalog, run: { definitionId: 'draft', version: 1 } }),
    ).toBeUndefined();
    expect(
      newerVersion({ catalog, run: { definitionId: 'gone', version: 1 } }),
    ).toBeUndefined();
  });
});
