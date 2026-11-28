import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildEnvironment,
  MOCK_PORT,
  renderEnvironment,
  writeEnvironmentFile,
} from './mockoon-environment.mjs';
import { SLOW_LATENCY_MS } from './mockoon-responses.mjs';
import { stableUuid } from './mockoon-rules.mjs';
import { ENVIRONMENT_PATH, readContract, readSeeds } from './project-files.mjs';

const contract = readContract();
const seeds = readSeeds();
const environment = buildEnvironment({ contract, seeds });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/;

function routeOf(endpoint, source = environment) {
  return source.routes.find((route) => route.endpoint === endpoint);
}

function headerOf(name) {
  return environment.headers.find((header) => header.key === name)?.value;
}

describe('arquivo de ambiente do Mockoon', () => {
  it('o versionado é o que o gerador produz hoje', () => {
    const versioned = readFileSync(ENVIRONMENT_PATH, 'utf8');

    expect(
      versioned,
      'rode: pnpm nx run backoffice-mock:generate-environment',
    ).toBe(renderEnvironment());
  });

  it('é gravado no caminho pedido, criando a pasta', () => {
    const path = join(
      mkdtempSync(join(tmpdir(), 'backoffice-mock-')),
      'nested',
      'environment.json',
    );

    writeEnvironmentFile(path);

    expect(readFileSync(path, 'utf8')).toBe(renderEnvironment());
  });
});

describe('buildEnvironment', () => {
  it('escuta na porta do container e libera o CORS do painel', () => {
    expect(environment.port).toBe(MOCK_PORT);
    expect(environment.cors).toBe(true);
    expect(headerOf('Access-Control-Allow-Headers')).toBe(
      'Content-Type, If-Match, X-Mock-Scenario',
    );
    expect(headerOf('Access-Control-Expose-Headers')).toBe('ETag');
  });

  it('carrega os dados iniciais nos data buckets das coleções', () => {
    for (const [path, documents] of Object.entries(seeds)) {
      const bucket = environment.data.find((item) => item.id === path);

      expect(JSON.parse(bucket.value)).toEqual(documents);
    }
  });

  it('guarda os schemas de envelope que as regras de 400 e 422 usam', () => {
    const bucket = environment.data.find((item) => item.id === 'envelopes');
    const schemas = JSON.parse(bucket.value);

    expect(Object.keys(schemas)).toEqual([
      'JsonContainer',
      'BoardDocument',
      'BoardDocumentList',
      'ProcessDefinitionDocument',
      'ProcessDefinitionDocumentList',
    ]);
    expect(schemas.BoardDocumentList.items).toEqual(schemas.BoardDocument);
  });

  it('recusa dado inicial com abertura de template', () => {
    const tainted = { ...seeds, boards: [{ id: 'board-1', name: '{{now}}' }] };

    expect(() => buildEnvironment({ contract, seeds: tainted })).toThrow(
      'Os dados de "boards" contêm "{{"',
    );
  });

  it('dá identificador estável e único a rotas, respostas e data buckets', () => {
    const ids = [
      environment.uuid,
      ...environment.data.map((item) => item.uuid),
      ...environment.routes.map((route) => route.uuid),
      ...environment.routes.flatMap((route) =>
        route.responses.map((response) => response.uuid),
      ),
    ];

    expect(ids.every((id) => UUID.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    expect(stableUuid('route:boards')).toBe(routeOf('boards').uuid);
    expect(environment.rootChildren.map((child) => child.uuid)).toEqual(
      environment.routes.map((route) => route.uuid),
    );
  });

  it('deixa a resposta padrão por último em cada rota de coleção', () => {
    for (const path of Object.keys(seeds)) {
      const { responses } = routeOf(path);
      const defaults = responses.filter((response) => response.default);

      expect(defaults).toEqual([responses.at(-1)]);
      expect(responses.at(-1).rules).toEqual([]);
      expect(responses.every((response) => response.crudKey === 'id')).toBe(
        true,
      );
    }
  });

  it('checa a gravação na ordem do contrato: 428, 404, 412 e só então o corpo', () => {
    const statuses = routeOf('boards')
      .responses.map((response) => response.statusCode)
      .filter((status) => [400, 404, 412, 422, 428].includes(status));

    expect(statuses.slice(0, 5)).toEqual([428, 404, 412, 400, 422]);
  });

  it('atrasa só as respostas de sucesso no cenário slow', () => {
    const slow = routeOf('boards').responses.filter(
      (response) => response.latency > 0,
    );

    expect(slow).toHaveLength(5);
    for (const response of slow) {
      expect(response.latency).toBe(SLOW_LATENCY_MS);
      expect(response.statusCode).toBeLessThan(300);
      expect(response.rules.at(-1)).toMatchObject({
        target: 'header',
        modifier: 'X-Mock-Scenario',
        value: 'slow',
      });
    }
  });

  it('remove o documento com 204 só onde o contrato tem DELETE', () => {
    const removes = (endpoint, source) =>
      routeOf(endpoint, source).responses.some(
        (response) => response.statusCode === 204,
      );
    const withoutDelete = structuredClone(contract);
    delete withoutDelete.paths['/boards/{id}'].delete;

    expect(removes('boards')).toBe(true);
    expect(removes('process-definitions')).toBe(false);
    expect(
      removes('boards', buildEnvironment({ contract: withoutDelete, seeds })),
    ).toBe(false);
  });

  it('serve a checagem de saúde fora das coleções', () => {
    const health = routeOf('health');

    expect(health).toMatchObject({ type: 'http', method: 'get' });
    expect(health.responses[0].body).toBe('{"status":"ok"}');
  });
});
