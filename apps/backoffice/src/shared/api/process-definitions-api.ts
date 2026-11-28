import type { ApiResult } from './api-result';
import type {
  NewProcessDefinitionDocument,
  ProcessDefinitionDocument,
} from './contract';
import {
  createDocumentResource,
  type EnvelopeSource,
  readEnvelope,
} from './document-resource';
import type { HttpClient } from './http-client';

// NOTE: não há remoção: o catálogo só arquiva, e arquivar é regravar a definição.
export interface ProcessDefinitionsApi {
  /** `GET /process-definitions`: os documentos inteiros. O item fora do contrato fica de fora. */
  readonly list: () => Promise<ApiResult<readonly ProcessDefinitionDocument[]>>;
  /** `POST /process-definitions`: grava o processo novo na revisão 1. */
  readonly create: (
    document: NewProcessDefinitionDocument,
  ) => Promise<ApiResult<ProcessDefinitionDocument>>;
  /** `GET /process-definitions/{id}`. */
  readonly get: (id: string) => Promise<ApiResult<ProcessDefinitionDocument>>;
  /** `PUT /process-definitions/{id}`: `document.revision` é a revisão lida, e a resposta traz a seguinte. */
  readonly update: (
    document: ProcessDefinitionDocument,
  ) => Promise<ApiResult<ProcessDefinitionDocument>>;
}

function toDefinitionDocument(
  source: EnvelopeSource,
): ProcessDefinitionDocument | null {
  const envelope = readEnvelope(source);
  if (envelope === null) {
    return null;
  }
  return {
    id: envelope.id,
    revision: envelope.revision,
    schemaVersion: envelope.schemaVersion,
    definition: envelope.fields.definition,
  };
}

function toListedDefinition(value: unknown): ProcessDefinitionDocument | null {
  return toDefinitionDocument({ value, etagRevision: null });
}

export function createProcessDefinitionsApi(
  client: HttpClient,
): ProcessDefinitionsApi {
  const resource = createDocumentResource({
    client,
    path: '/process-definitions',
    read: toDefinitionDocument,
  });
  return {
    list: () => resource.list(toListedDefinition),
    create: resource.create,
    get: resource.get,
    update: resource.update,
  };
}
