import { EMPTY_CATALOG, hasUnpublishedChanges } from '@/shared/process/catalog';
import { testDefinition } from '@/shared/process/catalog-test-data';

import {
  LEGACY_PROCESS_NAME,
  SAMPLE_PROCESS_NAME,
  seedCatalog,
} from './catalog-seed';
import { DOCUMENT_VERSION } from './model/document';
import { serializeDocument } from './model/draft';
import { sampleProcess } from './model/sample-process';

const AT = '2026-11-26T12:00:00.000Z';

const legacyText = serializeDocument({
  version: DOCUMENT_VERSION,
  lanes: [],
  graph: sampleProcess,
});

describe('seedCatalog', () => {
  it('cria o processo de exemplo publicado como versão 1', () => {
    const seeded = seedCatalog({
      catalog: EMPTY_CATALOG,
      legacyDraft: null,
      sample: sampleProcess,
      at: AT,
    });

    const [sample] = seeded.catalog.definitions;
    expect(seeded.catalog.definitions).toHaveLength(1);
    expect(sample.name).toBe(SAMPLE_PROCESS_NAME);
    expect(sample.versions.map((version) => version.version)).toEqual([1]);
    expect(hasUnpublishedChanges(sample)).toBe(false);
    expect(seeded.legacyUnreadable).toBe(false);
  });

  it('leva o rascunho antigo legível como o primeiro processo', () => {
    const seeded = seedCatalog({
      catalog: EMPTY_CATALOG,
      legacyDraft: legacyText,
      sample: sampleProcess,
      at: AT,
    });

    const names = seeded.catalog.definitions.map((item) => item.name);
    expect(names).toEqual([LEGACY_PROCESS_NAME, SAMPLE_PROCESS_NAME]);
    expect(seeded.catalog.definitions[0].draftText).toBe(legacyText);
    expect(seeded.catalog.definitions[0].versions).toEqual([]);
  });

  it('deixa de fora o rascunho antigo ilegível e avisa', () => {
    const seeded = seedCatalog({
      catalog: EMPTY_CATALOG,
      legacyDraft: '{quebrado',
      sample: sampleProcess,
      at: AT,
    });

    expect(seeded.legacyUnreadable).toBe(true);
    expect(seeded.catalog.definitions.map((item) => item.name)).toEqual([
      SAMPLE_PROCESS_NAME,
    ]);
  });

  it('não publica o exemplo que tem erro de validação', () => {
    const seeded = seedCatalog({
      catalog: EMPTY_CATALOG,
      legacyDraft: null,
      sample: { nodes: [], edges: [] },
      at: AT,
    });

    expect(seeded.catalog.definitions[0].versions).toEqual([]);
    expect(seeded.catalog.definitions[0].draftText).not.toBeNull();
  });

  it('devolve o catálogo que já tem processo sem mudar nada', () => {
    const catalog = { definitions: [testDefinition()] };

    const seeded = seedCatalog({
      catalog,
      legacyDraft: legacyText,
      sample: sampleProcess,
      at: AT,
    });

    expect(seeded.catalog).toBe(catalog);
    expect(seeded.legacyUnreadable).toBe(false);
  });
});
