import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parse } from 'yaml';

export const PROJECT_ROOT = join(import.meta.dirname, '..');
export const CONTRACT_PATH = join(PROJECT_ROOT, 'openapi.yaml');
export const ENVIRONMENT_PATH = join(
  PROJECT_ROOT,
  'mockoon',
  'environment.json',
);
export const SAMPLES_DIR = join(PROJECT_ROOT, 'samples');

// NOTE: uma coleção do contrato: o endereço, que também nomeia o data bucket
// e o arquivo de dados iniciais, o schema do documento e a amostra que o
// painel grava em `samples/`.
export const COLLECTIONS = [
  {
    path: 'boards',
    schema: 'BoardDocument',
    sample: 'board-document.json',
  },
  {
    path: 'process-definitions',
    schema: 'ProcessDefinitionDocument',
    sample: 'process-definition-document.json',
  },
];

export function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function readContract() {
  return parse(readFileSync(CONTRACT_PATH, 'utf8'));
}

export function seedPath(collection) {
  return join(PROJECT_ROOT, 'seed', `${collection.path}.json`);
}

export function readSeeds() {
  const seeds = {};
  for (const collection of COLLECTIONS) {
    seeds[collection.path] = readJson(seedPath(collection));
  }
  return seeds;
}

export function listSamples(directory = SAMPLES_DIR) {
  const samples = [];
  for (const name of readdirSync(directory).sort()) {
    if (name.endsWith('.json')) {
      samples.push({ name, value: readJson(join(directory, name)) });
    }
  }
  return samples;
}
