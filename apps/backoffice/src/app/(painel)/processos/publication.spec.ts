import type { ProcessCatalog } from '@/shared/process/catalog';
import { createCatalogSession } from '@/shared/process/catalog-session';
import {
  testDefinition,
  testPlan,
  testVersion,
} from '@/shared/process/catalog-test-data';

import { memoryCatalogStore } from './catalog-test-store';
import { DOCUMENT_VERSION } from './model/document';
import { sampleProcess } from './model/sample-process';
import {
  documentErrorCount,
  publishBlocker,
  publishDraft,
} from './publication';

const AT = '2026-11-26T12:00:00.000Z';

function catalogWith(versions = [testVersion(1)]) {
  return { definitions: [testDefinition({ versions })] };
}

/** A tela que já leu o catálogo gravado, de onde a publicação parte. */
async function screenOver(catalog: ProcessCatalog) {
  const store = memoryCatalogStore(catalog);
  const session = createCatalogSession({ store });
  await session.reload();
  return { store, session };
}

describe('publishDraft', () => {
  it('grava a versão seguinte junto com o rascunho', async () => {
    const { store, session } = await screenOver(catalogWith());

    const outcome = await publishDraft({
      commit: session.commit,
      definitionId: 'process-1',
      documentText: 'novo desenho',
      plan: testPlan,
      at: AT,
    });

    const saved = store.saved?.definitions[0];
    expect(outcome).toEqual({ kind: 'published', version: 2 });
    expect(saved?.versions.map((version) => version.version)).toEqual([1, 2]);
    expect(saved?.draftText).toBe('novo desenho');
  });

  it('publica a primeira versão do processo que só tinha rascunho', async () => {
    const { session } = await screenOver(catalogWith([]));

    const outcome = await publishDraft({
      commit: session.commit,
      definitionId: 'process-1',
      documentText: 'primeiro desenho',
      plan: testPlan,
      at: AT,
    });

    expect(outcome).toEqual({ kind: 'published', version: 1 });
  });

  it('devolve a recusa do catálogo com a mensagem', async () => {
    const { session } = await screenOver(catalogWith());

    const outcome = await publishDraft({
      commit: session.commit,
      definitionId: 'process-1',
      documentText: 'documento v1',
      plan: testPlan,
      at: AT,
    });

    expect(outcome).toEqual({
      kind: 'refused',
      message: 'Não há alterações desde a versão 1.',
    });
  });

  it('vira falha quando a gravação não é feita, e a versão não entra no processo', async () => {
    const { store, session } = await screenOver(catalogWith());
    store.failNext = true;

    const outcome = await publishDraft({
      commit: session.commit,
      definitionId: 'process-1',
      documentText: 'novo desenho',
      plan: testPlan,
      at: AT,
    });

    expect(outcome).toEqual({ kind: 'failed' });
    expect(store.saved?.definitions[0].versions).toHaveLength(1);
    expect(session.getSnapshot().catalog.definitions[0].versions).toHaveLength(
      1,
    );
  });
});

describe('documentErrorCount', () => {
  it('conta os erros do processo inteiro, inclusive das raias', () => {
    expect(
      documentErrorCount({
        version: DOCUMENT_VERSION,
        lanes: [],
        graph: sampleProcess,
      }),
    ).toBe(0);
    expect(
      documentErrorCount({
        version: DOCUMENT_VERSION,
        lanes: [],
        graph: { nodes: [], edges: [] },
      }),
    ).toBe(1);
  });
});

describe('publishBlocker', () => {
  it('pede para corrigir o erro', () => {
    expect(publishBlocker({ errors: 1, text: 'x', latest: undefined })).toBe(
      'Corrija o erro do processo para publicar.',
    );
  });

  it('conta os erros no plural', () => {
    expect(publishBlocker({ errors: 3, text: 'x', latest: undefined })).toBe(
      'Corrija os 3 erros do processo para publicar.',
    );
  });

  it('explica que não há o que publicar desde a última versão', () => {
    expect(
      publishBlocker({
        errors: 0,
        text: 'documento v2',
        latest: testVersion(2),
      }),
    ).toBe('Não há alterações desde a versão 2.');
  });

  it('libera a publicação do processo sem erro e com alteração', () => {
    expect(
      publishBlocker({ errors: 0, text: 'novo', latest: testVersion(1) }),
    ).toBeNull();
    expect(
      publishBlocker({ errors: 0, text: 'novo', latest: undefined }),
    ).toBeNull();
  });
});
