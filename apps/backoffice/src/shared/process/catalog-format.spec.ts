import type { ProcessCatalog } from './catalog';
import { parseCatalog, serializeCatalog } from './catalog-format';
import {
  TEST_CREATED_AT,
  testDefinition,
  testPlan,
  testVersion,
} from './catalog-test-data';

const UPDATED_AT = '2026-11-25T09:30:00.000Z';

const catalog: ProcessCatalog = {
  definitions: [
    testDefinition({
      description: 'Fluxo do suporte.',
      updatedAt: UPDATED_AT,
      draftText: 'rascunho do atendimento',
      versions: [testVersion(1), testVersion(2)],
    }),
    testDefinition({ id: 'process-2', name: 'Cobrança', archived: true }),
  ],
};

/** Texto gravado com as definições informadas, no formato atual. */
function storedText(definitions: readonly unknown[]): string {
  return JSON.stringify({ version: 1, definitions });
}

const storedSupport = {
  id: 'process-1',
  name: 'Atendimento',
  createdAt: TEST_CREATED_AT,
  updatedAt: UPDATED_AT,
  draftText: null,
  versions: [],
};

describe('serializeCatalog', () => {
  it('grava a versão do formato junto das definições', () => {
    expect(JSON.parse(serializeCatalog(catalog))).toEqual({
      version: 1,
      definitions: JSON.parse(JSON.stringify(catalog.definitions)),
    });
  });
});

describe('parseCatalog', () => {
  it('lê de volta o catálogo gravado', () => {
    expect(parseCatalog(serializeCatalog(catalog))).toEqual(catalog);
  });

  it('lê o catálogo sem processos', () => {
    expect(parseCatalog(storedText([]))).toEqual({ definitions: [] });
  });

  it.each([
    ['nada gravado', null],
    ['texto vazio', ''],
    ['JSON quebrado', '{quebrado'],
    ['valor que não é objeto', '[1, 2]'],
    ['versão desconhecida', JSON.stringify({ version: 2, definitions: [] })],
    [
      'definições fora de lista',
      JSON.stringify({ version: 1, definitions: 3 }),
    ],
  ])('não lê catálogo de %s', (_case, raw) => {
    expect(parseCatalog(raw)).toBeNull();
  });

  it.each([
    ['que não é objeto', 'process-1'],
    ['sem id', { ...storedSupport, id: ' ' }],
    ['sem nome', { ...storedSupport, name: '' }],
    ['sem data de criação legível', { ...storedSupport, createdAt: 'ontem' }],
  ])('descarta o processo %s e mantém os outros', (_case, broken) => {
    const other = { ...storedSupport, id: 'process-2', name: 'Cobrança' };

    const read = parseCatalog(storedText([broken, other]));

    expect(read?.definitions.map((definition) => definition.id)).toEqual([
      'process-2',
    ]);
  });

  it('lê os dados opcionais campo a campo', () => {
    const read = parseCatalog(
      storedText([
        {
          ...storedSupport,
          name: '  Atendimento  ',
          description: 7,
          updatedAt: 'nunca',
          draftText: 12,
          versions: 'nenhuma',
          archived: 'sim',
        },
      ]),
    );

    expect(read).toEqual({
      definitions: [{ ...storedSupport, updatedAt: TEST_CREATED_AT }],
    });
  });

  it('mantém o rascunho, a descrição e a marca de arquivado', () => {
    const read = parseCatalog(
      storedText([
        {
          ...storedSupport,
          description: 'Fluxo do suporte.',
          draftText: 'rascunho',
          archived: true,
        },
      ]),
    );

    expect(read?.definitions[0]).toMatchObject({
      description: 'Fluxo do suporte.',
      draftText: 'rascunho',
      archived: true,
    });
  });

  it.each([
    ['que não é objeto', 'v1'],
    ['sem número válido', { ...testVersion(1), version: 0 }],
    ['sem data legível', { ...testVersion(1), publishedAt: 'ontem' }],
    ['sem documento', { ...testVersion(1), documentText: undefined }],
    ['com roteiro ilegível', { ...testVersion(1), plan: { steps: [] } }],
  ])('descarta a versão %s e mantém as outras', (_case, broken) => {
    const read = parseCatalog(
      storedText([{ ...storedSupport, versions: [broken, testVersion(2)] }]),
    );

    expect(read?.definitions[0]?.versions).toEqual([testVersion(2)]);
  });

  it('fica com o primeiro processo de cada id', () => {
    const read = parseCatalog(
      storedText([
        storedSupport,
        { ...storedSupport, name: 'Repetido' },
        { ...storedSupport, id: 'process-2', name: 'Cobrança' },
      ]),
    );

    expect(read?.definitions.map((definition) => definition.name)).toEqual([
      'Atendimento',
      'Cobrança',
    ]);
  });

  it('fica com a primeira versão de cada número', () => {
    const repeated = { ...testVersion(1), documentText: 'outro documento' };

    const read = parseCatalog(
      storedText([
        {
          ...storedSupport,
          versions: [testVersion(1), repeated, testVersion(2)],
        },
      ]),
    );

    expect(
      read?.definitions[0]?.versions.map((version) => version.documentText),
    ).toEqual(['documento v1', 'documento v2']);
  });

  it('lê o roteiro de cada versão', () => {
    const read = parseCatalog(
      storedText([{ ...storedSupport, versions: [testVersion(1)] }]),
    );

    expect(read?.definitions[0]?.versions[0]?.plan).toEqual(testPlan);
  });
});
