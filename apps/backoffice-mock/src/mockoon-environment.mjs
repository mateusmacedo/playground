import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { documentEnvelope } from './contract.mjs';
import { collectionResponses } from './mockoon-responses.mjs';
import {
  ENVELOPES_BUCKET,
  JSON_CONTAINER,
  SCENARIO_HEADER,
  stableUuid,
} from './mockoon-rules.mjs';
import {
  COLLECTIONS,
  ENVIRONMENT_PATH,
  readContract,
  readSeeds,
} from './project-files.mjs';

// NOTE: porta em que o Mockoon escuta dentro do container; a do host vem do
// `docker-compose.yml`.
export const MOCK_PORT = 4010;

// NOTE: versão do formato do arquivo de ambiente do Mockoon 9.
const MOCKOON_MIGRATION = 33;

const TEMPLATE_OPENING = '{{';

function route({ key, type, method, endpoint, responses }) {
  return {
    uuid: stableUuid(`route:${key}`),
    type,
    documentation: '',
    method,
    endpoint,
    responses,
    responseMode: null,
    streamingMode: null,
    streamingInterval: 0,
  };
}

function healthRoute() {
  const response = {
    uuid: stableUuid('health:ok'),
    body: '{"status":"ok"}',
    latency: 0,
    statusCode: 200,
    label: 'Servidor no ar',
    headers: [],
    bodyType: 'INLINE',
    filePath: '',
    databucketID: '',
    sendFileAsBody: false,
    rules: [],
    rulesOperator: 'OR',
    disableTemplating: true,
    fallbackTo404: false,
    default: true,
    crudKey: 'id',
    callbacks: [],
  };
  return route({
    key: 'health',
    type: 'http',
    method: 'get',
    endpoint: 'health',
    responses: [response],
  });
}

function dataBucket({ id, documentation, value }) {
  const text = JSON.stringify(value);
  // WHY: o Mockoon passa o valor do data bucket pelo motor de templates; uma
  // abertura de template nos dados seria executada em vez de servida.
  if (text.includes(TEMPLATE_OPENING)) {
    throw new Error(`Os dados de "${id}" contêm "${TEMPLATE_OPENING}".`);
  }
  return {
    uuid: stableUuid(`data:${id}`),
    id,
    name: id,
    documentation,
    value: text,
  };
}

function envelopes(contract) {
  // WHY: `anyOf` em vez de lista de tipos, que o Ajv do Mockoon avisa no log a
  // cada requisição.
  const schemas = {
    [JSON_CONTAINER]: { anyOf: [{ type: 'object' }, { type: 'array' }] },
  };
  for (const collection of COLLECTIONS) {
    const envelope = documentEnvelope({
      contract,
      schemaName: collection.schema,
    });
    schemas[collection.schema] = envelope;
    schemas[`${collection.schema}List`] = { type: 'array', items: envelope };
  }
  return schemas;
}

function isDeletable({ contract, collection }) {
  return contract.paths[`/${collection.path}/{id}`]?.delete !== undefined;
}

export function buildEnvironment({ contract, seeds }) {
  const routes = [healthRoute()];
  const data = [];
  for (const collection of COLLECTIONS) {
    const deletable = isDeletable({ contract, collection });
    routes.push(
      route({
        key: collection.path,
        type: 'crud',
        method: '',
        endpoint: collection.path,
        responses: collectionResponses({ ...collection, deletable }),
      }),
    );
    data.push(
      dataBucket({
        id: collection.path,
        documentation: `Dados iniciais de /${collection.path}.`,
        value: seeds[collection.path],
      }),
    );
  }
  data.push(
    dataBucket({
      id: ENVELOPES_BUCKET,
      documentation:
        'Schemas do nível de cima dos documentos, usados pelas regras de 422.',
      value: envelopes(contract),
    }),
  );
  return {
    uuid: stableUuid('environment'),
    lastMigration: MOCKOON_MIGRATION,
    name: 'backoffice-mock',
    endpointPrefix: '',
    latency: 0,
    port: MOCK_PORT,
    hostname: '',
    folders: [],
    routes,
    rootChildren: routes.map((item) => ({ type: 'route', uuid: item.uuid })),
    proxyMode: false,
    proxyHost: '',
    proxyRemovePrefix: false,
    tlsOptions: {
      enabled: false,
      type: 'CERT',
      pfxPath: '',
      certPath: '',
      keyPath: '',
      caPath: '',
      passphrase: '',
    },
    cors: true,
    headers: [
      { key: 'Content-Type', value: 'application/json' },
      { key: 'Access-Control-Allow-Origin', value: '*' },
      {
        key: 'Access-Control-Allow-Methods',
        value: 'GET,POST,PUT,DELETE,OPTIONS',
      },
      {
        key: 'Access-Control-Allow-Headers',
        value: `Content-Type, If-Match, ${SCENARIO_HEADER}`,
      },
      { key: 'Access-Control-Expose-Headers', value: 'ETag' },
    ],
    proxyReqHeaders: [],
    proxyResHeaders: [],
    data,
    callbacks: [],
  };
}

export function renderEnvironment() {
  const environment = buildEnvironment({
    contract: readContract(),
    seeds: readSeeds(),
  });
  return `${JSON.stringify(environment, null, 2)}\n`;
}

export function writeEnvironmentFile(path = ENVIRONMENT_PATH) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, renderEnvironment());
}

if (import.meta.main) {
  writeEnvironmentFile();
}
