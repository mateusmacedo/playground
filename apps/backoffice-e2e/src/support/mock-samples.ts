import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { workspaceRoot } from '@nx/devkit';

import type { BoardSeed, ProcessDefinitionSeed } from './mock-documents';

const MOCK_ROOT = join(workspaceRoot, 'apps', 'backoffice-mock');
const INITIAL_BOARDS = 'seed/boards.json';
const INITIAL_DEFINITIONS = 'seed/process-definitions.json';
const SAMPLE_BOARD = 'samples/board-document.json';
const SAMPLE_DEFINITION = 'samples/process-definition-document.json';

interface Identified {
  readonly id: string;
}

function isIdentified(value: unknown): value is Identified {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string'
  );
}

function readMockFile(path: string): unknown {
  return JSON.parse(readFileSync(join(MOCK_ROOT, path), 'utf8'));
}

// NOTE: os arquivos do mock são conferidos contra o contrato pelos testes de `backoffice-mock`; aqui só a identidade é
// conferida, e a revisão sai porque quem decide a revisão é a semeadura.
function seedOf<T extends Identified>(document: unknown, path: string): T {
  if (!isIdentified(document)) {
    throw new Error(`O arquivo ${path} do mock não tem um documento com id.`);
  }
  const fields = Object.entries(document).filter(
    ([name]) => name !== 'revision',
  );
  return Object.fromEntries(fields) as T;
}

function firstOf<T extends Identified>(path: string): T {
  const documents = readMockFile(path);
  if (!Array.isArray(documents)) {
    throw new Error(`O arquivo ${path} do mock não é uma lista de documentos.`);
  }
  return seedOf<T>(documents[0], path);
}

/** O quadro `board-1` dos dados iniciais do mock: três colunas, quatro cards e três etiquetas. */
export function initialBoard(): BoardSeed {
  return firstOf<BoardSeed>(INITIAL_BOARDS);
}

/** O processo `process-1` dos dados iniciais do mock: Início, Primeira etapa e Fim, publicado na versão 1. */
export function initialDefinition(): ProcessDefinitionSeed {
  return firstOf<ProcessDefinitionSeed>(INITIAL_DEFINITIONS);
}

/** O quadro da amostra do contrato (`board-sample`): pessoas, regras ligadas e um card com processo em andamento. */
export function sampleBoard(): BoardSeed {
  return seedOf<BoardSeed>(readMockFile(SAMPLE_BOARD), SAMPLE_BOARD);
}

/** O processo da amostra do contrato ("Pedido de compra", com o id `process-1`), publicado e com roteiro. */
export function sampleDefinition(): ProcessDefinitionSeed {
  return seedOf<ProcessDefinitionSeed>(
    readMockFile(SAMPLE_DEFINITION),
    SAMPLE_DEFINITION,
  );
}
