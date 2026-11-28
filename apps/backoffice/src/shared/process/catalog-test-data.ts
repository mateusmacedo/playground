import type { ProcessDefinition, ProcessVersion } from './catalog';
import type { ProcessPlan } from './plan';

export const TEST_CREATED_AT = '2026-11-20T10:00:00.000Z';

/** Roteiro mínimo que a leitura do catálogo aceita: o início ligado ao fim. */
export const testPlan: ProcessPlan = {
  startId: 'start',
  steps: [
    {
      id: 'start',
      kind: 'start',
      label: 'Início',
      exits: [{ id: 'out', meaning: 'next', to: 'end' }],
    },
    { id: 'end', kind: 'end', label: 'Fim', exits: [] },
  ],
};

/** Versão publicada mínima, com o documento `documento v<número>`. */
export function testVersion(version: number): ProcessVersion {
  return {
    version,
    publishedAt: TEST_CREATED_AT,
    documentText: `documento v${version}`,
    plan: testPlan,
  };
}

/** Processo mínimo para os testes do catálogo; `overrides` troca só o que o teste precisa. */
export function testDefinition(
  overrides: Partial<ProcessDefinition> = {},
): ProcessDefinition {
  return {
    id: 'process-1',
    name: 'Atendimento',
    createdAt: TEST_CREATED_AT,
    updatedAt: TEST_CREATED_AT,
    draftText: null,
    versions: [],
    ...overrides,
  };
}
