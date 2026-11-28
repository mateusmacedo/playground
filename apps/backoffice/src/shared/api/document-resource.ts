import {
  isFilledText,
  isPositiveInteger,
  isRecord,
  type UnknownRecord,
} from '@/shared/process/stored-values';

import { type ApiResult, failed, succeeded } from './api-result';
import type { Unrevised } from './contract';
import type { HttpClient, HttpResponse } from './http-client';

/** O que todo documento da API traz em volta do conteúdo. */
export interface Envelope {
  readonly id: string;
  readonly revision: number;
  readonly schemaVersion: number;
  /** O objeto inteiro que veio, para cada recurso ler o que é só dele. */
  readonly fields: UnknownRecord;
}

export interface EnvelopeSource {
  /** Corpo da resposta, ou item de uma lista, ainda sem formato garantido. */
  readonly value: unknown;
  /** Revisão lida do `ETag` da resposta; `null` quando ela não veio, como nos itens de uma lista. */
  readonly etagRevision: number | null;
}

/**
 * Confere o envelope de um documento; `null` quando falta o id, a versão do formato ou a revisão. A revisão é a do
 * corpo, e a do `ETag` vale quando o corpo não traz a dele.
 */
export function readEnvelope(source: EnvelopeSource): Envelope | null {
  const { value, etagRevision } = source;
  if (!isRecord(value) || !isFilledText(value.id)) {
    return null;
  }
  const { schemaVersion } = value;
  if (typeof schemaVersion !== 'number' || !Number.isInteger(schemaVersion)) {
    return null;
  }
  // WHY: numa resposta de gravação o `ETag` pode ter sido calculado antes de a gravação valer, e sair com a revisão
  // anterior; a do corpo é a do documento que ficou gravado.
  const revision = isPositiveInteger(value.revision)
    ? value.revision
    : etagRevision;
  if (revision === null) {
    return null;
  }
  return { id: value.id, revision, schemaVersion, fields: value };
}

export interface Revisioned {
  readonly id: string;
  readonly revision: number;
}

/** Lê um documento da resposta; `null` quando ela está fora do contrato. */
export type DocumentReader<T> = (source: EnvelopeSource) => T | null;

/** Lê um item da lista; `null` tira o item da lista, sem derrubar os outros. */
export type ListItemReader<S> = (value: unknown) => S | null;

export interface DocumentResourceParams<T extends Revisioned> {
  readonly client: HttpClient;
  /** Caminho da coleção, como `/boards`. */
  readonly path: string;
  readonly read: DocumentReader<T>;
}

/** As operações de uma coleção de documentos inteiros, com controle de concorrência pela revisão. */
export interface DocumentResource<T extends Revisioned> {
  readonly list: <S>(
    readItem: ListItemReader<S>,
  ) => Promise<ApiResult<readonly S[]>>;
  /** Grava o documento novo na revisão 1. */
  readonly create: (document: Unrevised<T>) => Promise<ApiResult<T>>;
  readonly get: (id: string) => Promise<ApiResult<T>>;
  /**
   * Regrava o documento. `document.revision` é a revisão lida: vai em `If-Match`, e o corpo leva a seguinte. Devolve
   * o documento já na revisão nova, ou o erro `conflict` quando o servidor tem outra revisão gravada.
   */
  readonly update: (document: T) => Promise<ApiResult<T>>;
  readonly remove: (id: string) => Promise<ApiResult<void>>;
}

const FIRST_REVISION = 1;

export function createDocumentResource<T extends Revisioned>(
  params: DocumentResourceParams<T>,
): DocumentResource<T> {
  const { client, path, read } = params;

  const pathOf = (id: string): string => `${path}/${encodeURIComponent(id)}`;

  const readDocument = (result: ApiResult<HttpResponse>): ApiResult<T> => {
    if (!result.ok) {
      return result;
    }
    const { body, revision, status } = result.value;
    const document = read({ value: body, etagRevision: revision });
    if (document === null) {
      return failed({ kind: 'unexpected', status });
    }
    return succeeded(document);
  };

  return {
    async list<S>(readItem: ListItemReader<S>) {
      const result = await client.request({ method: 'GET', path });
      if (!result.ok) {
        return result;
      }
      const { body, status } = result.value;
      if (!Array.isArray(body)) {
        return failed({ kind: 'unexpected', status });
      }
      const items: S[] = [];
      for (const value of body) {
        const item = readItem(value);
        if (item !== null) {
          items.push(item);
        }
      }
      return succeeded(items);
    },
    async create(document) {
      const body = { ...document, revision: FIRST_REVISION };
      const result = await client.request({ method: 'POST', path, body });
      return readDocument(result);
    },
    async get(id) {
      const result = await client.request({ method: 'GET', path: pathOf(id) });
      return readDocument(result);
    },
    async update(document) {
      const body = { ...document, revision: document.revision + 1 };
      const result = await client.request({
        method: 'PUT',
        path: pathOf(document.id),
        body,
        ifMatch: document.revision,
      });
      return readDocument(result);
    },
    async remove(id) {
      const result = await client.request({
        method: 'DELETE',
        path: pathOf(id),
      });
      return result.ok ? succeeded(undefined) : result;
    },
  };
}
