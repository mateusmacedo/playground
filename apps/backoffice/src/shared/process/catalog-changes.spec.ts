import {
  type CatalogResult,
  EMPTY_CATALOG,
  findDefinition,
  type ProcessCatalog,
  type ProcessDefinition,
} from './catalog';
import {
  archiveDefinition,
  createDefinition,
  describeDefinition,
  duplicateDefinition,
  publishVersion,
  renameDefinition,
  restoreDefinition,
  saveDraft,
} from './catalog-changes';
import {
  TEST_CREATED_AT,
  testDefinition,
  testPlan,
  testVersion,
} from './catalog-test-data';
import type { ProcessPlan } from './plan';

const AT = '2026-11-26T15:00:00.000Z';

const support = testDefinition({
  description: 'Fluxo do suporte.',
  draftText: 'rascunho do atendimento',
});
const billing = testDefinition({ id: 'process-2', name: 'Cobrança' });
const retired = testDefinition({
  id: 'process-3',
  name: 'Devolução',
  archived: true,
});
const catalog: ProcessCatalog = { definitions: [support, billing, retired] };

interface ChangedDefinitionParams {
  readonly result: CatalogResult;
  readonly definitionId: string;
}

/** O processo de id `definitionId` depois da mudança; falha o teste se a mudança foi recusada. */
function changedDefinition(
  params: ChangedDefinitionParams,
): ProcessDefinition | undefined {
  const { result, definitionId } = params;
  if (!result.ok) {
    throw new Error(result.refusal.message);
  }
  return findDefinition({ catalog: result.catalog, definitionId });
}

function refusalCode(result: CatalogResult): string | undefined {
  return result.ok ? undefined : result.refusal.code;
}

describe('createDefinition', () => {
  it('cria o processo sem rascunho e sem versões', () => {
    const result = createDefinition({
      catalog: EMPTY_CATALOG,
      name: '  Compras  ',
      description: '  Pedidos de compra.  ',
      at: AT,
    });

    expect(result).toEqual({
      ok: true,
      catalog: {
        definitions: [
          {
            id: 'process-1',
            name: 'Compras',
            description: 'Pedidos de compra.',
            createdAt: AT,
            updatedAt: AT,
            draftText: null,
            versions: [],
          },
        ],
      },
      definitionId: 'process-1',
    });
  });

  it('cria o processo já com o rascunho informado', () => {
    const result = createDefinition({
      catalog,
      name: 'Compras',
      draftText: 'documento inicial',
      at: AT,
    });

    expect(
      changedDefinition({ result, definitionId: 'process-4' })?.draftText,
    ).toBe('documento inicial');
  });

  it('deixa sem descrição quando ela vem vazia', () => {
    const result = createDefinition({
      catalog,
      name: 'Compras',
      description: '   ',
      at: AT,
    });

    expect(
      changedDefinition({ result, definitionId: 'process-4' })?.description,
    ).toBeUndefined();
  });

  it('numera o id acima do maior em uso, ignorando os de outro formato', () => {
    const mixed: ProcessCatalog = {
      definitions: [
        testDefinition({ id: 'process-7', name: 'A' }),
        testDefinition({ id: 'process-x', name: 'B' }),
        testDefinition({ id: 'legado', name: 'C' }),
      ],
    };

    const result = createDefinition({ catalog: mixed, name: 'D', at: AT });

    expect(result.ok && result.definitionId).toBe('process-8');
  });

  it('mantém os processos que já estavam no catálogo', () => {
    const result = createDefinition({ catalog, name: 'Compras', at: AT });

    expect(changedDefinition({ result, definitionId: 'process-1' })).toBe(
      support,
    );
    expect(catalog.definitions).toHaveLength(3);
  });

  it('recusa o nome vazio', () => {
    const result = createDefinition({ catalog, name: '', at: AT });

    expect(refusalCode(result)).toBe('name-required');
  });

  it('recusa o nome repetido', () => {
    const result = createDefinition({ catalog, name: 'atendimento', at: AT });

    expect(refusalCode(result)).toBe('name-taken');
  });
});

describe('renameDefinition', () => {
  it('troca o nome e marca o instante da mudança', () => {
    const result = renameDefinition({
      catalog,
      definitionId: 'process-1',
      name: ' Suporte ',
      at: AT,
    });

    expect(changedDefinition({ result, definitionId: 'process-1' })).toEqual({
      ...support,
      name: 'Suporte',
      updatedAt: AT,
    });
  });

  it('aceita mudar só as maiúsculas do próprio nome', () => {
    const result = renameDefinition({
      catalog,
      definitionId: 'process-1',
      name: 'ATENDIMENTO',
      at: AT,
    });

    expect(changedDefinition({ result, definitionId: 'process-1' })?.name).toBe(
      'ATENDIMENTO',
    );
  });

  it('não mexe no catálogo quando o nome é o mesmo', () => {
    const result = renameDefinition({
      catalog,
      definitionId: 'process-1',
      name: 'Atendimento',
      at: AT,
    });

    expect(result).toEqual({ ok: true, catalog });
    expect(result.ok && result.catalog).toBe(catalog);
  });

  it('recusa o nome de outro processo', () => {
    const result = renameDefinition({
      catalog,
      definitionId: 'process-1',
      name: 'Cobrança',
      at: AT,
    });

    expect(refusalCode(result)).toBe('name-taken');
  });

  it('recusa o processo que não está no catálogo', () => {
    const result = renameDefinition({
      catalog,
      definitionId: 'process-9',
      name: 'Qualquer',
      at: AT,
    });

    expect(result).toEqual({
      ok: false,
      refusal: {
        code: 'not-found',
        message: 'Processo não encontrado no catálogo.',
      },
    });
  });
});

describe('describeDefinition', () => {
  it('troca a descrição e marca o instante da mudança', () => {
    const result = describeDefinition({
      catalog,
      definitionId: 'process-2',
      description: ' Cobrança de títulos. ',
      at: AT,
    });

    expect(changedDefinition({ result, definitionId: 'process-2' })).toEqual({
      ...billing,
      description: 'Cobrança de títulos.',
      updatedAt: AT,
    });
  });

  it('tira a descrição quando ela vem vazia', () => {
    const result = describeDefinition({
      catalog,
      definitionId: 'process-1',
      description: '  ',
      at: AT,
    });

    expect(
      changedDefinition({ result, definitionId: 'process-1' })?.description,
    ).toBeUndefined();
  });

  it('não mexe no catálogo quando a descrição é a mesma', () => {
    const result = describeDefinition({
      catalog,
      definitionId: 'process-1',
      description: 'Fluxo do suporte.',
      at: AT,
    });

    expect(result.ok && result.catalog).toBe(catalog);
  });

  it('recusa o processo que não está no catálogo', () => {
    const result = describeDefinition({
      catalog,
      definitionId: 'process-9',
      description: 'Texto',
      at: AT,
    });

    expect(refusalCode(result)).toBe('not-found');
  });
});

describe('duplicateDefinition', () => {
  it('copia o rascunho e a descrição, com outro nome e sem versões', () => {
    const published: ProcessCatalog = {
      definitions: [{ ...support, versions: [testVersion(1)], archived: true }],
    };

    const result = duplicateDefinition({
      catalog: published,
      definitionId: 'process-1',
      at: AT,
    });

    expect(result.ok && result.definitionId).toBe('process-2');
    expect(changedDefinition({ result, definitionId: 'process-2' })).toEqual({
      id: 'process-2',
      name: 'Atendimento (cópia)',
      description: 'Fluxo do suporte.',
      createdAt: AT,
      updatedAt: AT,
      draftText: 'rascunho do atendimento',
      versions: [],
    });
  });

  it('sem rascunho, copia o documento da última versão', () => {
    const published: ProcessCatalog = {
      definitions: [
        testDefinition({ versions: [testVersion(1), testVersion(2)] }),
      ],
    };

    const result = duplicateDefinition({
      catalog: published,
      definitionId: 'process-1',
      at: AT,
    });

    expect(
      changedDefinition({ result, definitionId: 'process-2' })?.draftText,
    ).toBe('documento v2');
  });

  it('sem rascunho nem versão, a cópia nasce sem rascunho', () => {
    const result = duplicateDefinition({
      catalog,
      definitionId: 'process-2',
      at: AT,
    });

    expect(
      changedDefinition({ result, definitionId: 'process-4' })?.draftText,
    ).toBeNull();
  });

  it('numera o nome da cópia quando o anterior já está em uso', () => {
    const first = duplicateDefinition({
      catalog,
      definitionId: 'process-2',
      at: AT,
    });
    const second = duplicateDefinition({
      catalog: first.ok ? first.catalog : catalog,
      definitionId: 'process-2',
      at: AT,
    });
    const third = duplicateDefinition({
      catalog: second.ok ? second.catalog : catalog,
      definitionId: 'process-2',
      at: AT,
    });

    expect(
      changedDefinition({ result: second, definitionId: 'process-5' })?.name,
    ).toBe('Cobrança (cópia 2)');
    expect(
      changedDefinition({ result: third, definitionId: 'process-6' })?.name,
    ).toBe('Cobrança (cópia 3)');
  });

  it('recusa o processo que não está no catálogo', () => {
    const result = duplicateDefinition({
      catalog,
      definitionId: 'process-9',
      at: AT,
    });

    expect(refusalCode(result)).toBe('not-found');
  });
});

describe('archiveDefinition', () => {
  it('arquiva o processo e marca o instante da mudança', () => {
    const result = archiveDefinition({
      catalog,
      definitionId: 'process-1',
      at: AT,
    });

    expect(changedDefinition({ result, definitionId: 'process-1' })).toEqual({
      ...support,
      archived: true,
      updatedAt: AT,
    });
  });

  it('não mexe no catálogo quando o processo já está arquivado', () => {
    const result = archiveDefinition({
      catalog,
      definitionId: 'process-3',
      at: AT,
    });

    expect(result.ok && result.catalog).toBe(catalog);
  });

  it('recusa o processo que não está no catálogo', () => {
    const result = archiveDefinition({
      catalog,
      definitionId: 'process-9',
      at: AT,
    });

    expect(refusalCode(result)).toBe('not-found');
  });
});

describe('restoreDefinition', () => {
  it('restaura o processo arquivado e marca o instante da mudança', () => {
    const result = restoreDefinition({
      catalog,
      definitionId: 'process-3',
      at: AT,
    });

    const restored = changedDefinition({ result, definitionId: 'process-3' });
    expect(restored?.archived).toBeUndefined();
    expect(restored?.updatedAt).toBe(AT);
  });

  it('não mexe no catálogo quando o processo não está arquivado', () => {
    const result = restoreDefinition({
      catalog,
      definitionId: 'process-1',
      at: AT,
    });

    expect(result.ok && result.catalog).toBe(catalog);
  });

  it('recusa o processo que não está no catálogo', () => {
    const result = restoreDefinition({
      catalog,
      definitionId: 'process-9',
      at: AT,
    });

    expect(refusalCode(result)).toBe('not-found');
  });
});

describe('saveDraft', () => {
  it('guarda o texto do rascunho e marca o instante da mudança', () => {
    const result = saveDraft({
      catalog,
      definitionId: 'process-2',
      text: 'rascunho da cobrança',
      at: AT,
    });

    expect(changedDefinition({ result, definitionId: 'process-2' })).toEqual({
      ...billing,
      draftText: 'rascunho da cobrança',
      updatedAt: AT,
    });
  });

  it('não mexe no catálogo quando o texto é o mesmo', () => {
    const result = saveDraft({
      catalog,
      definitionId: 'process-1',
      text: 'rascunho do atendimento',
      at: AT,
    });

    expect(result.ok && result.catalog).toBe(catalog);
  });

  it('recusa o processo que não está no catálogo', () => {
    const result = saveDraft({
      catalog,
      definitionId: 'process-9',
      text: 'texto',
      at: AT,
    });

    expect(refusalCode(result)).toBe('not-found');
  });
});

describe('publishVersion', () => {
  it('publica a versão 1 e iguala o rascunho ao documento publicado', () => {
    const result = publishVersion({
      catalog,
      definitionId: 'process-1',
      documentText: 'documento publicado',
      plan: testPlan,
      at: AT,
    });

    const version = {
      version: 1,
      publishedAt: AT,
      documentText: 'documento publicado',
      plan: testPlan,
    };
    expect(result.ok && result.version).toEqual(version);
    expect(changedDefinition({ result, definitionId: 'process-1' })).toEqual({
      ...support,
      draftText: 'documento publicado',
      versions: [version],
      updatedAt: AT,
    });
  });

  it('numera a versão seguinte e mantém as anteriores como estavam', () => {
    const first = testVersion(1);
    const second = testVersion(2);
    const published: ProcessCatalog = {
      definitions: [testDefinition({ versions: [second, first] })],
    };

    const result = publishVersion({
      catalog: published,
      definitionId: 'process-1',
      documentText: 'documento v3',
      plan: testPlan,
      at: AT,
    });

    const versions =
      changedDefinition({ result, definitionId: 'process-1' })?.versions ?? [];
    expect(result.ok && result.version.version).toBe(3);
    expect(versions[0]).toBe(second);
    expect(versions[1]).toBe(first);
    expect(versions).toHaveLength(3);
  });

  it('recusa publicar de novo o documento da última versão', () => {
    const published: ProcessCatalog = {
      definitions: [testDefinition({ versions: [testVersion(1)] })],
    };

    const result = publishVersion({
      catalog: published,
      definitionId: 'process-1',
      documentText: 'documento v1',
      plan: testPlan,
      at: AT,
    });

    expect(result).toEqual({
      ok: false,
      refusal: {
        code: 'nothing-to-publish',
        message: 'Não há alterações desde a versão 1.',
      },
    });
  });

  it('recusa o roteiro que a leitura do catálogo não aceitaria', () => {
    const broken: ProcessPlan = { ...testPlan, startId: 'missing' };

    const result = publishVersion({
      catalog,
      definitionId: 'process-1',
      documentText: 'documento publicado',
      plan: broken,
      at: AT,
    });

    expect(result).toEqual({
      ok: false,
      refusal: {
        code: 'invalid-plan',
        message: 'O desenho não forma um roteiro que possa ser executado.',
      },
    });
  });

  it('publica o roteiro como a leitura do catálogo o devolveria', () => {
    const dangling: ProcessPlan = {
      startId: 'start',
      steps: [
        {
          id: 'start',
          kind: 'start',
          label: 'Início',
          exits: [{ id: 'out', meaning: 'next', to: 'missing' }],
        },
      ],
    };

    const result = publishVersion({
      catalog,
      definitionId: 'process-1',
      documentText: 'documento publicado',
      plan: dangling,
      at: AT,
    });

    const exit = result.ok ? result.version.plan.steps[0]?.exits[0] : null;
    expect(exit).toEqual({ id: 'out', meaning: 'next' });
  });

  it('recusa o processo que não está no catálogo', () => {
    const result = publishVersion({
      catalog,
      definitionId: 'process-9',
      documentText: 'documento publicado',
      plan: testPlan,
      at: AT,
    });

    expect(refusalCode(result)).toBe('not-found');
  });

  it('não muda o instante de criação do processo', () => {
    const result = publishVersion({
      catalog,
      definitionId: 'process-1',
      documentText: 'documento publicado',
      plan: testPlan,
      at: AT,
    });

    expect(
      changedDefinition({ result, definitionId: 'process-1' })?.createdAt,
    ).toBe(TEST_CREATED_AT);
  });
});
