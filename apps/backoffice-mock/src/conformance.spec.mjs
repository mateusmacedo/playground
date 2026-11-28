import { describe, expect, it } from 'vitest';

import {
  closedContract,
  createValidator,
  listOperations,
  schemaPointer,
} from './contract.mjs';
import { servesOperation } from './mockoon-routes.mjs';
import {
  COLLECTIONS,
  ENVIRONMENT_PATH,
  listSamples,
  readContract,
  readJson,
  readSeeds,
} from './project-files.mjs';

const contract = readContract();
const validate = createValidator(contract);
const validateClosed = createValidator(closedContract(contract));
const seeds = readSeeds();
const environment = readJson(ENVIRONMENT_PATH);

describe('dados iniciais', () => {
  it.each(COLLECTIONS)('os de /$path validam contra $schema', (collection) => {
    const pointer = schemaPointer(collection.schema);

    expect(seeds[collection.path].length).toBeGreaterThan(0);
    for (const value of seeds[collection.path]) {
      expect(validate({ pointer, value })).toEqual([]);
    }
  });

  it.each(COLLECTIONS)(
    'os de /$path só usam campo que o contrato descreve',
    (collection) => {
      const pointer = schemaPointer(collection.schema);

      for (const value of seeds[collection.path]) {
        expect(validateClosed({ pointer, value })).toEqual([]);
      }
    },
  );

  it.each(COLLECTIONS)(
    'os de /$path têm id único e começam na revisão 1',
    (collection) => {
      const documents = seeds[collection.path];
      const ids = documents.map((document) => document.id);

      expect(new Set(ids).size).toBe(ids.length);
      expect(documents.map((document) => document.revision)).toEqual(
        ids.map(() => 1),
      );
    },
  );

  it('trazem o quadro padrão do painel, que também serve de item da lista', () => {
    const [board] = seeds.boards;

    expect(board).toMatchObject({ id: 'board-1', name: 'Quadro principal' });
    expect(
      validate({ pointer: schemaPointer('BoardSummary'), value: board }),
    ).toEqual([]);
  });

  it('trazem um processo publicado, com o id repetido no envelope', () => {
    const [document] = seeds['process-definitions'];

    expect(document.definition.id).toBe(document.id);
    expect(document.definition.versions).toHaveLength(1);
    expect(document.definition.draftText).toBe(
      document.definition.versions[0].documentText,
    );
  });
});

describe('amostras gravadas pelo painel', () => {
  it('cada amostra tem um schema conhecido e valida contra ele', () => {
    for (const sample of listSamples()) {
      const collection = COLLECTIONS.find(
        (item) => item.sample === sample.name,
      );

      expect(collection, `amostra sem schema: ${sample.name}`).toBeDefined();
      const pointer = schemaPointer(collection.schema);
      const { value } = sample;
      expect(validate({ pointer, value }), sample.name).toEqual([]);
      expect(validateClosed({ pointer, value }), sample.name).toEqual([]);
    }
  });
});

describe('rotas do Mockoon', () => {
  it.each(listOperations(contract))('atendem $method $path', (operation) => {
    expect(servesOperation({ environment, operation })).toBe(true);
  });
});
