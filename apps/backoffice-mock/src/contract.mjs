import Ajv2020 from 'ajv/dist/2020.js';

const HTTP_METHODS = [
  'get',
  'put',
  'post',
  'delete',
  'patch',
  'options',
  'head',
  'trace',
];

const LOCAL_REF_PREFIX = '#/';

// NOTE: campos da raiz de um documento OpenAPI 3.1, que não são palavras de
// JSON Schema.
const OPENAPI_ROOT_FIELDS = [
  'openapi',
  'info',
  'jsonSchemaDialect',
  'servers',
  'paths',
  'webhooks',
  'components',
  'security',
  'tags',
  'externalDocs',
];

export function listOperations(contract) {
  const operations = [];
  for (const [path, item] of Object.entries(contract.paths)) {
    for (const method of HTTP_METHODS) {
      if (item[method] !== undefined) {
        operations.push({
          method,
          path,
          operationId: item[method].operationId,
        });
      }
    }
  }
  return operations;
}

function decodePointerToken(token) {
  return token.replaceAll('~1', '/').replaceAll('~0', '~');
}

export function encodePointerToken(token) {
  return token.replaceAll('~', '~0').replaceAll('/', '~1');
}

export function resolveRef({ contract, ref }) {
  if (!ref.startsWith(LOCAL_REF_PREFIX)) {
    throw new Error(`Referência fora do contrato: ${ref}`);
  }
  let target = contract;
  for (const token of ref.slice(LOCAL_REF_PREFIX.length).split('/')) {
    target = target?.[decodePointerToken(token)];
  }
  if (target === undefined) {
    throw new Error(`Referência sem destino no contrato: ${ref}`);
  }
  return target;
}

function envelopeProperty({ contract, property }) {
  const resolved =
    property.$ref === undefined
      ? property
      : resolveRef({ contract, ref: property.$ref });
  const shape = { type: resolved.type };
  for (const keyword of ['minimum', 'minLength']) {
    if (resolved[keyword] !== undefined) {
      shape[keyword] = resolved[keyword];
    }
  }
  return shape;
}

// WHY: as regras do Mockoon validam com um Ajv de draft-07 sem as referências
// do contrato; o envelope leva só o nível de cima do documento, que é o que o
// mock precisa para não gravar algo sem `id` nem `revision`.
export function documentEnvelope({ contract, schemaName }) {
  const schema = resolveRef({
    contract,
    ref: `#/components/schemas/${schemaName}`,
  });
  const properties = {};
  for (const [name, property] of Object.entries(schema.properties)) {
    properties[name] = envelopeProperty({ contract, property });
  }
  return { type: 'object', required: schema.required, properties };
}

function closeSchema(schema) {
  if (Array.isArray(schema)) {
    return schema.map(closeSchema);
  }
  if (typeof schema !== 'object' || schema === null) {
    return schema;
  }
  const closed = {};
  for (const [key, value] of Object.entries(schema)) {
    closed[key] = closeSchema(value);
  }
  const describesFields =
    typeof schema.properties === 'object' && schema.properties !== null;
  if (describesFields && schema.additionalProperties === undefined) {
    closed.additionalProperties = false;
  }
  return closed;
}

// WHY: o contrato tolera campo a mais na leitura, mas o que o painel grava
// tem de estar descrito nele. A cópia fechada acusa o campo que o contrato não
// conhece; o schema que declara `additionalProperties` continua como está.
export function closedContract(contract) {
  return {
    ...contract,
    components: {
      ...contract.components,
      schemas: closeSchema(contract.components.schemas),
    },
  };
}

function describeError(error) {
  const where = error.instancePath === '' ? '(raiz)' : error.instancePath;
  const params = JSON.stringify(error.params);
  return `${where}: ${error.message} ${params}`;
}

const CONTRACT_ID = 'contract';

// NOTE: `pointer` é um ponteiro JSON para um schema dentro do contrato, como
// `/components/schemas/BoardDocument`.
export function createValidator(contract) {
  const ajv = new Ajv2020({
    strict: true,
    allErrors: true,
    allowUnionTypes: true,
    // WHY: `format` só anota; o painel aceita qualquer instante que o `Date`
    // leia, e o contrato não pode ser mais restrito que ele.
    validateFormats: false,
  });
  // WHY: o contrato inteiro entra como schema, para as referências
  // `#/components/schemas/...` resolverem; o modo estrito precisa conhecer os
  // campos da raiz do OpenAPI para não os tomar por erro de digitação.
  ajv.addVocabulary(OPENAPI_ROOT_FIELDS);
  ajv.addSchema(contract, CONTRACT_ID);
  return function validate({ pointer, value }) {
    const check = ajv.getSchema(`${CONTRACT_ID}#${pointer}`);
    if (check === undefined) {
      throw new Error(`Schema ausente no contrato: ${pointer}`);
    }
    return check(value) ? [] : check.errors.map(describeError);
  };
}

export function schemaPointer(schemaName) {
  return `/components/schemas/${schemaName}`;
}
