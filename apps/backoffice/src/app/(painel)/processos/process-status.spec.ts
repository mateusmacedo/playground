import {
  testDefinition,
  testVersion,
} from '@/shared/process/catalog-test-data';

import { processStatus } from './process-status';

describe('processStatus', () => {
  it('chama de rascunho o processo nunca publicado', () => {
    expect(processStatus(testDefinition({ draftText: 'x' }))).toEqual({
      kind: 'draft',
      label: 'Rascunho',
    });
  });

  it('mostra a última versão publicada quando o rascunho é o publicado', () => {
    const definition = testDefinition({
      draftText: 'documento v2',
      versions: [testVersion(1), testVersion(2)],
    });

    expect(processStatus(definition)).toEqual({
      kind: 'published',
      label: 'Publicada v2',
    });
  });

  it('avisa das alterações não publicadas', () => {
    const definition = testDefinition({
      draftText: 'outro desenho',
      versions: [testVersion(1)],
    });

    expect(processStatus(definition)).toEqual({
      kind: 'changed',
      label: 'Publicada v1, com alterações não publicadas',
    });
  });
});
