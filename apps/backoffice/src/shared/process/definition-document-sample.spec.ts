import { readFileSync, writeFileSync } from 'node:fs';

import type { ProcessDefinitionDocument } from '@/shared/api/contract';

import type { ProcessDefinition } from './catalog';
import { createDefinition, publishVersion, saveDraft } from './catalog-changes';
import { createHttpCatalogStore } from './catalog-http-store';
import { createCatalogSession } from './catalog-session';
import { contractProjectFile } from './contract-project-file';
import { definitionContent, readDefinition } from './definition-documents';
import {
  SAMPLE_DRAFT_TEXT,
  SAMPLE_PUBLISHED_TEXT,
  samplePlan,
} from './definition-sample-data';
import { fakeDefinitionsApi } from './definitions-api-fake';
import type { PlanStep } from './plan';
import { parsePlan } from './plan-parse';

// NOTE: a amostra fica no projeto do contrato, que a valida contra os schemas do `openapi.yaml`.
const SAMPLE_FILE = contractProjectFile(
  'samples/process-definition-document.json',
);
const SEED_FILE = contractProjectFile('seed/process-definitions.json');

const HOW_TO_UPDATE = [
  'A amostra apps/backoffice-mock/samples/process-definition-document.json não é mais o que o painel grava.',
  'Se a mudança de formato é de propósito, regrave a amostra, formate-a e confira o contrato:',
  '  UPDATE_SAMPLES=1 pnpm nx test backoffice --skip-nx-cache -- src/shared/process/definition-document-sample.spec.ts',
  '  pnpm exec biome format --write apps/backoffice-mock/samples/process-definition-document.json',
  '  pnpm nx run backoffice-mock:test',
  'Se o contrato recusar a amostra nova, o que muda é o apps/backoffice-mock/openapi.yaml, não a amostra.',
].join('\n');

const DEFINITION_ID = 'process-1';
const CREATED_AT = '2026-11-20T10:00:00.000Z';
const PUBLISHED_AT = '2026-11-21T14:30:00.000Z';
const DRAFT_AT = '2026-11-22T09:15:00.000Z';

/** O valor como ele viaja: sem os campos ausentes. */
function throughJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(file, 'utf8'));
}

/** A amostra gravada; `null` enquanto o arquivo não existe. */
function readSample(): unknown {
  try {
    return readJson(SAMPLE_FILE);
  } catch {
    // WHY: sem o arquivo, o teste falha com a instrução de como gravar, e não com o erro de leitura.
    return null;
  }
}

/**
 * O documento que o painel grava na API para um processo criado, publicado e depois editado: sai do adaptador HTTP,
 * depois das três gravações, e por isso chega com a revisão 3.
 */
async function sampleDocument(): Promise<ProcessDefinitionDocument> {
  const api = fakeDefinitionsApi();
  const session = createCatalogSession({ store: createHttpCatalogStore(api) });
  await session.reload();
  await session.commit((catalog) =>
    createDefinition({
      catalog,
      name: 'Pedido de compra',
      description: 'Do pedido à compra feita, com a aprovação da diretoria.',
      draftText: SAMPLE_PUBLISHED_TEXT,
      at: CREATED_AT,
    }),
  );
  await session.commit((catalog) =>
    publishVersion({
      catalog,
      definitionId: DEFINITION_ID,
      documentText: SAMPLE_PUBLISHED_TEXT,
      plan: samplePlan,
      at: PUBLISHED_AT,
    }),
  );
  await session.commit((catalog) =>
    saveDraft({
      catalog,
      definitionId: DEFINITION_ID,
      text: SAMPLE_DRAFT_TEXT,
      at: DRAFT_AT,
    }),
  );
  const stored = api.stored(DEFINITION_ID);
  if (stored === undefined) {
    throw new Error('O processo da amostra não chegou à API simulada.');
  }
  return stored;
}

function stepOf(id: string): PlanStep | undefined {
  return samplePlan.steps.find((step) => step.id === id);
}

describe('amostra do documento de definição de processo', () => {
  it('tem versão publicada e rascunho com alteração por publicar', async () => {
    const document = await sampleDocument();
    const definition = document.definition as ProcessDefinition;

    expect(document).toMatchObject({
      id: DEFINITION_ID,
      revision: 3,
      schemaVersion: 1,
    });
    expect(definition.versions).toHaveLength(1);
    expect(definition.versions[0].documentText).toBe(SAMPLE_PUBLISHED_TEXT);
    expect(definition.draftText).toBe(SAMPLE_DRAFT_TEXT);
    expect(definition.updatedAt).toBe(DRAFT_AT);
  });

  it('tem no roteiro aprovação, campos por etapa, decisão, paralelo e subprocesso', () => {
    const kinds = samplePlan.steps.map((step) => step.kind);
    const fieldTypes = stepOf('request')?.fields?.map((field) => field.type);

    expect(kinds).toEqual(
      expect.arrayContaining([
        'human-task',
        'approval',
        'decision',
        'parallel-split',
        'parallel-join',
        'merge',
        'subprocess',
      ]),
    );
    expect(fieldTypes).toEqual([
      'text',
      'long-text',
      'number',
      'date',
      'choice',
      'checkbox',
    ]);
    expect(stepOf('approve')?.exits.map((exit) => exit.meaning)).toEqual([
      'approved',
      'rejected',
    ]);
    expect(stepOf('high')?.defaultExitId).toBe('no');
    expect(stepOf('payment')?.inner?.steps).toHaveLength(3);
  });

  it('guarda o roteiro como a leitura do catálogo o devolve', () => {
    expect(throughJson(parsePlan(samplePlan))).toEqual(samplePlan);
  });

  it('é relida pelo painel sem perda', async () => {
    const document = throughJson(await sampleDocument());

    const definition = readDefinition(document);

    expect(definition).not.toBeNull();
    expect(definitionContent(definition as ProcessDefinition)).toEqual({
      id: document.id,
      schemaVersion: document.schemaVersion,
      definition: document.definition,
    });
  });

  it('é a que está gravada no projeto do contrato', async () => {
    const document = throughJson(await sampleDocument());
    if (process.env.UPDATE_SAMPLES === '1') {
      writeFileSync(SAMPLE_FILE, `${JSON.stringify(document, null, 2)}\n`);
    }

    expect(readSample(), HOW_TO_UPDATE).toEqual(document);
  });
});

describe('definições de processo dos dados iniciais do mock', () => {
  const seed = readJson(SEED_FILE) as readonly ProcessDefinitionDocument[];

  it('trazem pelo menos um processo publicado', () => {
    const published = seed
      .map(readDefinition)
      .filter((definition) => (definition?.versions.length ?? 0) > 0);

    expect(published.length).toBeGreaterThan(0);
  });

  it.each(seed)('o painel lê $id sem perda', (document) => {
    const definition = readDefinition(document);

    expect(definition).not.toBeNull();
    expect(definitionContent(definition as ProcessDefinition)).toEqual({
      id: document.id,
      schemaVersion: document.schemaVersion,
      definition: document.definition,
    });
  });

  it('chegam todas ao catálogo pelo adaptador da API', async () => {
    const api = fakeDefinitionsApi();
    vi.spyOn(api, 'list').mockResolvedValue({ ok: true, value: seed });

    const read = await createHttpCatalogStore(api).load();

    expect(read.ok && read.catalog?.definitions.map((item) => item.id)).toEqual(
      seed.map((document) => document.id),
    );
  });
});
