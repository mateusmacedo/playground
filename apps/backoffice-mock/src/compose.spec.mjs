import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

import { MOCK_PORT } from './mockoon-environment.mjs';
import { PROJECT_ROOT, readContract } from './project-files.mjs';

const composeText = readFileSync(
  join(PROJECT_ROOT, 'docker-compose.yml'),
  'utf8',
);
const compose = parse(composeText);
const envExample = readFileSync(join(PROJECT_ROOT, '.env.example'), 'utf8');
const services = Object.values(compose.services);

function exampleValue(name) {
  return new RegExp(`^${name}=(.*)$`, 'm').exec(envExample)?.[1];
}

describe('docker-compose.yml', () => {
  it('tem nome de projeto próprio, para não se misturar ao do Floci', () => {
    expect(compose.name).toBe('playground-backoffice-mock');
  });

  it('fixa toda imagem por tag e digest', () => {
    for (const service of services) {
      expect(service.image).toMatch(/:[\w.-]+@sha256:[0-9a-f]{64}$/);
    }
  });

  it('publica a porta só em loopback, na porta em que o Mockoon escuta', () => {
    for (const service of services) {
      for (const port of service.ports) {
        expect(port).toMatch(/^127\.0\.0\.1:/);
        expect(port.endsWith(`:${MOCK_PORT}`)).toBe(true);
      }
    }
  });

  it('limita a memória e checa a saúde de todo serviço', () => {
    for (const service of services) {
      expect(service.mem_limit).toMatch(/^\d+m$/);
      expect(service.healthcheck.test.join(' ')).toContain(
        `http://127.0.0.1:${MOCK_PORT}/health`,
      );
    }
  });

  it('tem toda variável documentada no .env.example, com o mesmo padrão', () => {
    const used = [
      ...composeText.matchAll(/\$\{([A-Z_][A-Z0-9_]*):-([^}]*)\}/g),
    ];

    expect(used.length).toBeGreaterThan(0);
    for (const [, name, fallback] of used) {
      expect(exampleValue(name), name).toBe(fallback);
    }
    expect(composeText).not.toMatch(/\$\{[A-Z_][A-Z0-9_]*\}/);
  });

  it('publica por padrão o endereço que o contrato anuncia', () => {
    const [server] = readContract().servers;

    expect(server.url).toBe(
      `http://127.0.0.1:${exampleValue('BACKOFFICE_MOCK_PORT')}`,
    );
  });
});
