import { Validator } from '@seriousme/openapi-schema-validator';
import { describe, expect, it } from 'vitest';

import {
  closedContract,
  createValidator,
  documentEnvelope,
  encodePointerToken,
  listOperations,
  resolveRef,
  schemaPointer,
} from './contract.mjs';
import { readContract } from './project-files.mjs';

const contract = readContract();
const operations = listOperations(contract);

const SUCCESS = /^2/;
const PROBLEM_TYPE = 'application/problem+json';

function resolved(item) {
  return item.$ref === undefined
    ? item
    : resolveRef({ contract, ref: item.$ref });
}

function responsesOf(operation) {
  const declared = contract.paths[operation.path][operation.method].responses;
  return Object.entries(declared).map(([status, response]) => ({
    status,
    response: resolved(response),
    pointer:
      response.$ref === undefined
        ? `/paths/${encodePointerToken(operation.path)}/${operation.method}/responses/${status}`
        : response.$ref.slice(1),
  }));
}

// NOTE: cada corpo do contrato, de requisição ou de resposta, com o ponteiro
// do schema dele e os exemplos que traz.
function describedBodies() {
  const bodies = [];
  const add = ({ where, pointer, content }) => {
    for (const [type, media] of Object.entries(content ?? {})) {
      const examples = Object.values(media.examples ?? {}).map(
        (example) => resolved(example).value,
      );
      bodies.push({
        where: `${where} (${type})`,
        type,
        pointer:
          media.schema.$ref === undefined
            ? `${pointer}/content/${encodePointerToken(type)}/schema`
            : media.schema.$ref.slice(1),
        examples,
      });
    }
  };
  for (const operation of operations) {
    const { path, method } = operation;
    const base = `/paths/${encodePointerToken(path)}/${method}`;
    add({
      where: `${method} ${path}, requisição`,
      pointer: `${base}/requestBody`,
      content: contract.paths[path][method].requestBody?.content,
    });
    for (const { status, response, pointer } of responsesOf(operation)) {
      add({
        where: `${method} ${path}, resposta ${status}`,
        pointer,
        content: response.content,
      });
    }
  }
  return bodies;
}

describe('contrato OpenAPI', () => {
  it('é um documento OpenAPI 3.1 válido, com as referências resolvidas', async () => {
    const validator = new Validator();

    const result = await validator.validate(structuredClone(contract));

    expect(result.errors).toBeUndefined();
    expect(result.valid).toBe(true);
    expect(validator.version).toBe('3.1');
  });

  it('prevê as operações dos quadros e das definições, sem remover definição', () => {
    const listed = operations.map(
      (operation) => `${operation.method} ${operation.path}`,
    );

    expect(listed).toEqual([
      'get /boards',
      'post /boards',
      'get /boards/{id}',
      'put /boards/{id}',
      'delete /boards/{id}',
      'get /process-definitions',
      'post /process-definitions',
      'get /process-definitions/{id}',
      'put /process-definitions/{id}',
    ]);
  });

  it('dá um operationId único a cada operação', () => {
    const ids = operations.map((operation) => operation.operationId);

    expect(ids.every((id) => typeof id === 'string' && id !== '')).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('descreve toda recusa com Problem Details', () => {
    for (const operation of operations) {
      for (const { status, response } of responsesOf(operation)) {
        if (SUCCESS.test(status)) {
          continue;
        }
        expect(Object.keys(response.content)).toEqual([PROBLEM_TYPE]);
        expect(response.content[PROBLEM_TYPE].schema.$ref).toBe(
          `#${schemaPointer('Problem')}`,
        );
      }
    }
  });

  it('prevê 500 e 503 em toda operação', () => {
    for (const operation of operations) {
      const statuses = responsesOf(operation).map((item) => item.status);

      expect(statuses).toEqual(expect.arrayContaining(['500', '503']));
    }
  });

  it('devolve o ETag na leitura de um documento e em toda gravação', () => {
    const withTag = operations.filter(
      (operation) =>
        ['put', 'post'].includes(operation.method) ||
        (operation.method === 'get' && operation.path.endsWith('{id}')),
    );

    expect(withTag).toHaveLength(6);
    for (const operation of withTag) {
      const success = responsesOf(operation).find((item) =>
        SUCCESS.test(item.status),
      );

      expect(resolved(success.response.headers.ETag).schema.type).toBe(
        'string',
      );
    }
  });

  it('exige o If-Match e prevê 404, 412 e 428 em toda gravação de documento', () => {
    const replacements = operations.filter(
      (operation) => operation.method === 'put',
    );

    expect(replacements).toHaveLength(2);
    for (const operation of replacements) {
      const { parameters } = contract.paths[operation.path].put;
      const ifMatch = parameters
        .map(resolved)
        .find((parameter) => parameter.name === 'If-Match');
      const statuses = responsesOf(operation).map((item) => item.status);

      expect(ifMatch).toMatchObject({ in: 'header', required: true });
      expect(statuses).toEqual(
        expect.arrayContaining(['400', '404', '412', '422', '428']),
      );
    }
  });
});

describe('exemplos do contrato', () => {
  const bodies = describedBodies();
  const validate = createValidator(contract);
  const validateClosed = createValidator(closedContract(contract));

  it('todo corpo descrito traz pelo menos um exemplo', () => {
    const missing = bodies.filter((body) => body.examples.length === 0);

    expect(missing.map((body) => body.where)).toEqual([]);
  });

  it.each(bodies)('os de $where validam contra o schema', (body) => {
    for (const value of body.examples) {
      expect(validate({ pointer: body.pointer, value })).toEqual([]);
    }
  });

  it.each(bodies)(
    'os de $where só usam campo que o contrato descreve',
    (body) => {
      for (const value of body.examples) {
        expect(validateClosed({ pointer: body.pointer, value })).toEqual([]);
      }
    },
  );
});

describe('resolveRef', () => {
  it('segue a referência local, com `/` escapado no caminho', () => {
    const target = resolveRef({ contract, ref: '#/paths/~1boards/get' });

    expect(target.operationId).toBe('listBoards');
  });

  it('recusa a referência para fora do contrato', () => {
    expect(() =>
      resolveRef({ contract, ref: 'outro.yaml#/components/schemas/Board' }),
    ).toThrow('Referência fora do contrato');
  });

  it('recusa a referência sem destino', () => {
    expect(() =>
      resolveRef({ contract, ref: '#/components/schemas/Missing/properties' }),
    ).toThrow('Referência sem destino no contrato');
  });
});

describe('documentEnvelope', () => {
  it('leva o nível de cima do documento, sem entrar nos schemas referenciados', () => {
    const envelope = documentEnvelope({
      contract,
      schemaName: 'ProcessDefinitionDocument',
    });

    expect(envelope).toEqual({
      type: 'object',
      required: ['id', 'revision', 'schemaVersion', 'definition'],
      properties: {
        id: { type: 'string', minLength: 1 },
        revision: { type: 'integer', minimum: 1 },
        schemaVersion: { type: 'integer', minimum: 1 },
        definition: { type: 'object' },
      },
    });
  });
});

describe('closedContract', () => {
  const closed = closedContract(contract).components.schemas;

  it('fecha o schema que descreve campos, em qualquer profundidade', () => {
    const nested = closedContract({
      components: {
        schemas: {
          Outer: {
            type: 'object',
            properties: {
              list: {
                type: 'array',
                items: { type: 'object', properties: { id: {} } },
              },
            },
          },
        },
      },
    }).components.schemas.Outer;

    expect(nested.additionalProperties).toBe(false);
    expect(nested.properties.list.items.additionalProperties).toBe(false);
  });

  it('mantém aberto o schema que declara `additionalProperties`', () => {
    expect(closed.BoardDocument.additionalProperties).toBe(false);
    expect(closed.CardActivity.additionalProperties).toBe(true);
    expect(closed.BoardSummary.additionalProperties).toBe(true);
  });

  it('não altera o contrato original', () => {
    expect(contract.components.schemas.BoardDocument).not.toHaveProperty(
      'additionalProperties',
    );
  });
});

describe('createValidator', () => {
  const validate = createValidator(contract);
  const pointer = schemaPointer('Problem');

  it('aceita o valor que segue o schema', () => {
    const value = { type: 'about:blank', title: 'Falha', status: 500 };

    expect(validate({ pointer, value })).toEqual([]);
  });

  it('aponta o campo que falta e o campo de tipo errado', () => {
    const errors = validate({ pointer, value: { type: 'x', status: 'y' } });

    expect(errors).toHaveLength(2);
    expect(errors[0]).toContain('(raiz)');
    expect(errors[0]).toContain('"missingProperty":"title"');
    expect(errors[1]).toContain('/status');
  });

  it('não confere o formato, que o painel lê de forma mais ampla', () => {
    const comment = { id: 'c1', at: '26/11/2026', author: 'Ana', text: 'Oi' };

    expect(
      validate({ pointer: schemaPointer('CardComment'), value: comment }),
    ).toEqual([]);
  });

  it('recusa o ponteiro que não leva a um schema', () => {
    expect(() =>
      validate({ pointer: schemaPointer('Missing'), value: {} }),
    ).toThrow('Schema ausente no contrato');
  });
});
