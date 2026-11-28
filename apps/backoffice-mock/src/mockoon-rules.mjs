import { createHash } from 'node:crypto';

// NOTE: cabeçalho de teste que escolhe um cenário do mock; fica fora do contrato.
export const SCENARIO_HEADER = 'X-Mock-Scenario';

export const ENVELOPES_BUCKET = 'envelopes';

// NOTE: schema do data bucket de envelopes que só aceita objeto ou lista, ou
// seja, um corpo que o Mockoon conseguiu ler como JSON.
export const JSON_CONTAINER = 'JsonContainer';

export const URL_ID = "(urlParam 'id')";
export const BODY_ID = "(bodyRaw 'id')";

// WHY: o Mockoon repara, com um UUID aleatório, o identificador que não é
// UUID; derivado do nome, o arquivo gerado é o mesmo a cada execução.
export function stableUuid(name) {
  const hex = createHash('sha256').update(name).digest('hex');
  const groups = [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    `a${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ];
  return groups.join('-');
}

// NOTE: `id` é uma expressão de template, como `URL_ID`; sem o documento, a
// expressão resulta em texto vazio.
export function storedField({ bucket, id, field }) {
  return `dataRaw '${bucket}' (concat '$[?(@.id=="' ${id} '")].${field}')`;
}

// NOTE: o Mockoon compara o método em minúsculas.
export function methodIs(name) {
  return {
    target: 'method',
    modifier: '',
    value: name,
    invert: false,
    operator: 'equals',
  };
}

export function methodIn(names) {
  return {
    target: 'method',
    modifier: '',
    value: `^(${names.join('|')})$`,
    invert: false,
    operator: 'regex',
  };
}

export function urlHasId(present) {
  return {
    target: 'params',
    modifier: 'id',
    value: '.+',
    invert: !present,
    operator: 'regex',
  };
}

export function scenarioIs(name) {
  return {
    target: 'header',
    modifier: SCENARIO_HEADER,
    value: name,
    invert: false,
    operator: 'equals',
  };
}

export function ifMatchMissing() {
  return {
    target: 'header',
    modifier: 'If-Match',
    value: '',
    invert: false,
    operator: 'null',
  };
}

export function documentExists({ bucket, id, exists }) {
  return {
    target: 'templating',
    modifier: `{{${storedField({ bucket, id, field: 'id' })}}}`,
    value: '',
    invert: exists,
    operator: 'null',
  };
}

export function templateIsFalse(expression) {
  return {
    target: 'templating',
    modifier: `{{${expression}}}`,
    value: 'true',
    invert: true,
    operator: 'equals',
  };
}

export function bodyFailsEnvelope(schemaName) {
  return {
    target: 'body',
    modifier: '',
    value: `${ENVELOPES_BUCKET}.${schemaName}`,
    invert: true,
    operator: 'valid_json_schema',
  };
}

export function bodyFieldIsNot({ field, value }) {
  return {
    target: 'body',
    modifier: field,
    value,
    invert: true,
    operator: 'equals',
  };
}
