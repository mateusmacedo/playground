import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  COLLECTIONS,
  listSamples,
  readSeeds,
  seedPath,
} from './project-files.mjs';

describe('listSamples', () => {
  it('lê só os arquivos JSON da pasta, em ordem de nome', () => {
    const directory = mkdtempSync(join(tmpdir(), 'backoffice-mock-samples-'));
    writeFileSync(join(directory, 'b.json'), '{"id":"b"}');
    writeFileSync(join(directory, 'a.json'), '{"id":"a"}');
    writeFileSync(join(directory, '.gitkeep'), '');

    expect(listSamples(directory)).toEqual([
      { name: 'a.json', value: { id: 'a' } },
      { name: 'b.json', value: { id: 'b' } },
    ]);
  });

  it('só aceita, na pasta do projeto, as amostras das coleções', () => {
    const expected = COLLECTIONS.map((collection) => collection.sample);

    for (const sample of listSamples()) {
      expect(expected).toContain(sample.name);
    }
  });
});

describe('readSeeds', () => {
  it('lê os dados iniciais de cada coleção pelo endereço dela', () => {
    const seeds = readSeeds();

    expect(Object.keys(seeds)).toEqual(['boards', 'process-definitions']);
    expect(seedPath(COLLECTIONS[0])).toMatch(/seed\/boards\.json$/);
  });
});
