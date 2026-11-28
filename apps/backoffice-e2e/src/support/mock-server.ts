import type { APIRequestContext, APIResponse } from '@playwright/test';

import type { MockAddress } from './mock-address';
import type {
  BoardDocument,
  BoardSeed,
  ProcessDefinitionDocument,
  ProcessDefinitionSeed,
} from './mock-documents';

const HEALTH_PATH = '/health';
const HEALTH_TIMEOUT_MS = 5_000;
const PURGE_PATH = '/mockoon-admin/data-buckets/purge';
const BOARDS_PATH = '/boards';
const DEFINITIONS_PATH = '/process-definitions';
const NOT_FOUND = 404;
const FIRST_REVISION = 1;

export interface MockServerParams {
  readonly request: APIRequestContext;
  readonly address: MockAddress;
}

export interface MockServer {
  /** Volta o mock aos dados iniciais. */
  readonly reset: () => Promise<void>;
  /** `null` quando o mock não tem o quadro. */
  readonly readBoard: (id: string) => Promise<BoardDocument | null>;
  /** Cria o quadro ou regrava o que existe, e devolve o documento na revisão que ficou gravada. */
  readonly seedBoard: (seed: BoardSeed) => Promise<BoardDocument>;
  /** Todas as definições gravadas, inclusive as arquivadas, na ordem em que foram criadas. */
  readonly listDefinitions: () => Promise<readonly ProcessDefinitionDocument[]>;
  /** `null` quando o mock não tem a definição. */
  readonly readDefinition: (
    id: string,
  ) => Promise<ProcessDefinitionDocument | null>;
  /** Cria a definição ou regrava a que existe, e devolve o documento na revisão que ficou gravada. */
  readonly seedDefinition: (
    seed: ProcessDefinitionSeed,
  ) => Promise<ProcessDefinitionDocument>;
}

interface Stored {
  readonly id: string;
  readonly revision: number;
}

function isStored(value: unknown): value is Stored {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    'revision' in value &&
    Number.isInteger(value.revision)
  );
}

async function unexpectedAnswer(response: APIResponse): Promise<Error> {
  const body = await response.text();
  return new Error(
    `O mock respondeu ${response.status()} em ${response.url()}: ${body}`,
  );
}

async function storedIn<T extends Stored>(response: APIResponse): Promise<T> {
  if (!response.ok()) {
    throw await unexpectedAnswer(response);
  }
  const body: unknown = await response.json();
  if (!isStored(body)) {
    throw await unexpectedAnswer(response);
  }
  // NOTE: o mock devolve o documento como foi gravado; aqui só a identidade e a revisão são conferidas.
  return body as T;
}

interface DocumentAddress {
  readonly collectionUrl: string;
  readonly id: string;
}

function documentUrl({ collectionUrl, id }: DocumentAddress): string {
  return `${collectionUrl}/${encodeURIComponent(id)}`;
}

interface ReadParams {
  readonly request: APIRequestContext;
  readonly url: string;
}

async function readDocument<T extends Stored>({
  request,
  url,
}: ReadParams): Promise<T | null> {
  const response = await request.get(url);
  if (response.status() === NOT_FOUND) {
    return null;
  }
  return storedIn<T>(response);
}

interface SeedParams {
  readonly request: APIRequestContext;
  readonly collectionUrl: string;
  readonly seed: { readonly id: string };
}

// WHY: a semeadura usa só as operações do contrato, com a mesma concorrência por revisão que o painel usa; assim um
// quadro semeado no meio do teste aparece para o painel como a gravação de outra pessoa.
async function seedDocument<T extends Stored>({
  request,
  collectionUrl,
  seed,
}: SeedParams): Promise<T> {
  const url = documentUrl({ collectionUrl, id: seed.id });
  const current = await readDocument<T>({ request, url });
  if (current === null) {
    const created = await request.post(collectionUrl, {
      data: { ...seed, revision: FIRST_REVISION },
    });
    return storedIn<T>(created);
  }
  const updated = await request.put(url, {
    headers: { 'If-Match': `"${current.revision}"` },
    data: { ...seed, revision: current.revision + 1 },
  });
  return storedIn<T>(updated);
}

async function listDocuments<T extends Stored>({
  request,
  url,
}: ReadParams): Promise<readonly T[]> {
  const response = await request.get(url);
  if (!response.ok()) {
    throw await unexpectedAnswer(response);
  }
  const body: unknown = await response.json();
  if (!Array.isArray(body) || !body.every(isStored)) {
    throw await unexpectedAnswer(response);
  }
  // NOTE: como em `storedIn`, só a identidade e a revisão de cada documento são conferidas.
  return body as T[];
}

async function answersHealth({
  request,
  address,
}: MockServerParams): Promise<boolean> {
  try {
    const response = await request.get(`${address.apiUrl}${HEALTH_PATH}`, {
      timeout: HEALTH_TIMEOUT_MS,
    });
    return response.ok();
  } catch {
    // WHY: sem o container a chamada lança erro de conexão; quem chama troca os dois casos pela instrução de como subir.
    return false;
  }
}

/** Falha com a instrução de como subir o mock quando ele não está no ar. */
export async function assertMockIsUp(params: MockServerParams): Promise<void> {
  if (await answersHealth(params)) {
    return;
  }
  throw new Error(
    `O mock da API do painel não respondeu em ${params.address.apiUrl}${HEALTH_PATH}. ` +
      'Suba o container com `pnpm nx run backoffice-mock:up` e rode o e2e de novo.',
  );
}

async function resetData({
  request,
  address,
}: MockServerParams): Promise<void> {
  const response = await request.post(`${address.apiUrl}${PURGE_PATH}`, {
    headers: { Authorization: `Bearer ${address.adminToken}` },
  });
  if (!response.ok()) {
    throw await unexpectedAnswer(response);
  }
}

export function createMockServer({
  request,
  address,
}: MockServerParams): MockServer {
  const boardsUrl = `${address.apiUrl}${BOARDS_PATH}`;
  const definitionsUrl = `${address.apiUrl}${DEFINITIONS_PATH}`;
  return {
    reset: () => resetData({ request, address }),
    readBoard: (id) =>
      readDocument<BoardDocument>({
        request,
        url: documentUrl({ collectionUrl: boardsUrl, id }),
      }),
    seedBoard: (seed) =>
      seedDocument<BoardDocument>({
        request,
        collectionUrl: boardsUrl,
        seed,
      }),
    listDefinitions: () =>
      listDocuments<ProcessDefinitionDocument>({
        request,
        url: definitionsUrl,
      }),
    readDefinition: (id) =>
      readDocument<ProcessDefinitionDocument>({
        request,
        url: documentUrl({ collectionUrl: definitionsUrl, id }),
      }),
    seedDefinition: (seed) =>
      seedDocument<ProcessDefinitionDocument>({
        request,
        collectionUrl: definitionsUrl,
        seed,
      }),
  };
}
