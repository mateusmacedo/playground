import {
  findDefinition,
  findVersion,
  hasUnpublishedChanges,
  latestVersion,
  type ProcessCatalog,
  publishedDefinitions,
} from './catalog';
import { testDefinition, testVersion } from './catalog-test-data';

const support = testDefinition({
  versions: [testVersion(1), testVersion(2)],
});
const billing = testDefinition({ id: 'process-2', name: 'Cobrança' });
const catalog: ProcessCatalog = { definitions: [support, billing] };

describe('findDefinition', () => {
  it('encontra o processo pelo id', () => {
    expect(findDefinition({ catalog, definitionId: 'process-2' })).toBe(
      billing,
    );
  });

  it('não encontra o id que não está no catálogo', () => {
    expect(
      findDefinition({ catalog, definitionId: 'process-9' }),
    ).toBeUndefined();
  });
});

describe('latestVersion', () => {
  it('devolve a versão de maior número, em qualquer ordem', () => {
    const shuffled = testDefinition({
      versions: [testVersion(2), testVersion(3), testVersion(1)],
    });

    expect(latestVersion(shuffled)?.version).toBe(3);
  });

  it('não devolve nada enquanto o processo não foi publicado', () => {
    expect(latestVersion(billing)).toBeUndefined();
  });
});

describe('findVersion', () => {
  it('encontra a versão pelo número', () => {
    const found = findVersion({
      catalog,
      definitionId: 'process-1',
      version: 1,
    });

    expect(found?.documentText).toBe('documento v1');
  });

  it('não encontra o número que não foi publicado', () => {
    expect(
      findVersion({ catalog, definitionId: 'process-1', version: 3 }),
    ).toBeUndefined();
  });

  it('não encontra versão de processo que não está no catálogo', () => {
    expect(
      findVersion({ catalog, definitionId: 'process-9', version: 1 }),
    ).toBeUndefined();
  });
});

describe('publishedDefinitions', () => {
  it('lista só os processos não arquivados que têm versão publicada', () => {
    const archived = testDefinition({
      id: 'process-3',
      name: 'Antigo',
      versions: [testVersion(1)],
      archived: true,
    });

    const published = publishedDefinitions({
      definitions: [support, billing, archived],
    });

    expect(published).toEqual([support]);
  });
});

describe('hasUnpublishedChanges', () => {
  it('não tem alterações sem rascunho salvo', () => {
    expect(hasUnpublishedChanges(support)).toBe(false);
  });

  it('tem alterações quando o rascunho nunca foi publicado', () => {
    const drafted = testDefinition({ draftText: 'documento novo' });

    expect(hasUnpublishedChanges(drafted)).toBe(true);
  });

  it('não tem alterações quando o rascunho é o documento da última versão', () => {
    const published = testDefinition({
      draftText: 'documento v2',
      versions: [testVersion(1), testVersion(2)],
    });

    expect(hasUnpublishedChanges(published)).toBe(false);
  });

  it('tem alterações quando o rascunho mudou depois da última versão', () => {
    const edited = testDefinition({
      draftText: 'documento v1',
      versions: [testVersion(1), testVersion(2)],
    });

    expect(hasUnpublishedChanges(edited)).toBe(true);
  });
});
