import { baseResponse, refusals, storedRevision } from './mockoon-refusals.mjs';
import {
  methodIs,
  scenarioIs,
  stableUuid,
  URL_ID,
  urlHasId,
} from './mockoon-rules.mjs';

// NOTE: atraso das respostas do cenário `slow`, em milissegundos.
export const SLOW_LATENCY_MS = 1500;

function withSlow(normal) {
  const slow = {
    ...normal,
    uuid: stableUuid(`${normal.uuid}:slow`),
    label: `${normal.label} (cenário slow)`,
    latency: SLOW_LATENCY_MS,
    rules: [...normal.rules, scenarioIs('slow')],
    default: false,
  };
  return [slow, normal];
}

function stored({ collection, key, label, rules, headers }) {
  return {
    ...baseResponse({ collection, key, label }),
    bodyType: 'DATABUCKET',
    databucketID: collection.path,
    rules,
    headers,
  };
}

// WHY: a remoção do CRUD do Mockoon responde 200 com `{}`; o contrato pede
// 204, então o template tira o documento do data bucket.
function removal(collection) {
  const bucket = collection.path;
  return {
    ...baseResponse({ collection, key: 'delete', label: 'Remove o documento' }),
    statusCode: 204,
    body: `{{#each (dataRaw '${bucket}')}}{{#if (eq id ${URL_ID})}}{{setData 'del' '${bucket}' @index}}{{/if}}{{/each}}`,
    rules: [methodIs('delete'), urlHasId(true)],
  };
}

// WHY: o Mockoon monta os cabeçalhos antes de gravar; na gravação a revisão
// nova está no corpo, e na leitura está no data bucket.
function successes(collection) {
  const writtenTag = [{ key: 'ETag', value: `"{{bodyRaw 'revision'}}"` }];
  const storedTag = [
    { key: 'ETag', value: `"{{${storedRevision(collection)}}}"` },
  ];
  const list = collection.deletable ? withSlow(removal(collection)) : [];
  const replace = stored({
    collection,
    key: 'replace',
    label: 'Grava o documento',
    rules: [methodIs('put'), urlHasId(true)],
    headers: writtenTag,
  });
  const create = stored({
    collection,
    key: 'create',
    label: 'Cria o documento',
    rules: [methodIs('post')],
    headers: writtenTag,
  });
  const read = stored({
    collection,
    key: 'read',
    label: 'Lê o documento',
    rules: [methodIs('get'), urlHasId(true)],
    headers: storedTag,
  });
  const whole = stored({
    collection,
    key: 'collection',
    label: 'Lista ou semeia a coleção',
    rules: [],
    headers: [],
  });
  list.push(...withSlow(replace), ...withSlow(create), ...withSlow(read));
  list.push(...withSlow({ ...whole, default: true }));
  return list;
}

// NOTE: a primeira resposta cuja regra casa é a servida; por isso as recusas
// vêm antes, e a resposta padrão fica por último.
export function collectionResponses(collection) {
  return [...refusals(collection), ...successes(collection)];
}
