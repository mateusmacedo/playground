import {
  BODY_ID,
  bodyFailsEnvelope,
  bodyFieldIsNot,
  documentExists,
  ifMatchMissing,
  JSON_CONTAINER,
  methodIn,
  methodIs,
  scenarioIs,
  stableUuid,
  storedField,
  templateIsFalse,
  URL_ID,
  urlHasId,
} from './mockoon-rules.mjs';

const PROBLEM_HEADERS = [
  { key: 'Content-Type', value: 'application/problem+json' },
];

const INSTANCE_MARK = '@@instance@@';
const REVISION_MARK = '@@revision@@';

export function baseResponse({ collection, key, label }) {
  return {
    uuid: stableUuid(`${collection.path}:${key}`),
    body: '',
    latency: 0,
    statusCode: 200,
    label,
    headers: [],
    bodyType: 'INLINE',
    filePath: '',
    databucketID: '',
    sendFileAsBody: false,
    rules: [],
    rulesOperator: 'AND',
    disableTemplating: false,
    fallbackTo404: false,
    default: false,
    crudKey: 'id',
    callbacks: [],
  };
}

export function storedRevision(collection) {
  return storedField({
    bucket: collection.path,
    id: URL_ID,
    field: 'revision',
  });
}

// WHY: as expressões de template têm aspas duplas, que o `JSON.stringify`
// escaparia; por isso entram no corpo já serializado, no lugar das marcas.
function problemBody({ collection, problem }) {
  const text = JSON.stringify({
    type: `urn:playground:problem:${problem.type}`,
    title: problem.title,
    status: problem.status,
    detail: problem.detail,
    instance: INSTANCE_MARK,
  });
  const instance = `/${collection.path}{{#if ${URL_ID}}}/{{urlParam 'id'}}{{/if}}`;
  const revision = `{{${storedRevision(collection)}}}`;
  // NOTE: função no lugar do texto, para o `$` do JSONPath não ser lido como
  // padrão de substituição.
  return text
    .replace(INSTANCE_MARK, () => instance)
    .replace(REVISION_MARK, () => revision);
}

function problemResponse({ collection, key, problem, rules }) {
  return {
    ...baseResponse({ collection, key, label: problem.title }),
    body: problemBody({ collection, problem }),
    statusCode: problem.status,
    headers: PROBLEM_HEADERS,
    rules,
  };
}

function scenarioFailures(collection) {
  return [
    problemResponse({
      collection,
      key: 'scenario-error',
      problem: {
        status: 500,
        type: 'internal-error',
        title: 'Falha inesperada',
        detail: 'O servidor não conseguiu concluir a requisição.',
      },
      rules: [scenarioIs('error')],
    }),
    problemResponse({
      collection,
      key: 'scenario-unavailable',
      problem: {
        status: 503,
        type: 'unavailable',
        title: 'Serviço indisponível',
        detail:
          'O servidor está indisponível no momento. Tente de novo em instantes.',
      },
      rules: [scenarioIs('unavailable')],
    }),
  ];
}

// NOTE: a rota CRUD do Mockoon aceita mais do que o contrato; o que fica de
// fora dele é recusado, menos o `PUT` da coleção, que semeia os testes.
function outOfContract(collection) {
  const problem = {
    status: 405,
    type: 'method-not-allowed',
    title: 'Operação fora do contrato',
    detail: 'A API não tem esta operação neste endereço.',
  };
  const removal = collection.deletable
    ? [methodIs('delete'), urlHasId(false)]
    : [methodIs('delete')];
  return [
    problemResponse({
      collection,
      key: 'patch-refused',
      problem,
      rules: [methodIs('patch')],
    }),
    problemResponse({
      collection,
      key: 'delete-refused',
      problem,
      rules: removal,
    }),
  ];
}

function invalidDocument(detail) {
  return {
    status: 422,
    type: 'invalid-document',
    title: 'Documento inválido',
    detail,
  };
}

function preconditions(collection) {
  const replace = [methodIs('put'), urlHasId(true)];
  const revision = storedRevision(collection);
  return [
    problemResponse({
      collection,
      key: 'precondition-required',
      problem: {
        status: 428,
        type: 'precondition-required',
        title: 'Falta o cabeçalho If-Match',
        detail: 'Envie no If-Match a revisão lida, entre aspas duplas.',
      },
      rules: [...replace, ifMatchMissing()],
    }),
    problemResponse({
      collection,
      key: 'not-found',
      problem: {
        status: 404,
        type: 'not-found',
        title: 'Documento não encontrado',
        detail: 'Não existe documento com este id.',
      },
      rules: [
        urlHasId(true),
        documentExists({ bucket: collection.path, id: URL_ID, exists: false }),
      ],
    }),
    problemResponse({
      collection,
      key: 'revision-mismatch',
      problem: {
        status: 412,
        type: 'revision-mismatch',
        title: 'Revisão desatualizada',
        detail: `A revisão gravada é ${REVISION_MARK}, diferente da enviada no If-Match.`,
      },
      rules: [
        ...replace,
        templateIsFalse(
          `eq (header 'If-Match') (concat '"' (${revision}) '"')`,
        ),
      ],
    }),
  ];
}

function malformedBody(collection) {
  return [
    problemResponse({
      collection,
      key: 'malformed-body',
      problem: {
        status: 400,
        type: 'malformed-body',
        title: 'Corpo ilegível',
        detail: 'O corpo da requisição não é um JSON válido.',
      },
      rules: [methodIn(['post', 'put']), bodyFailsEnvelope(JSON_CONTAINER)],
    }),
  ];
}

function replaceGuards(collection) {
  const replace = [methodIs('put'), urlHasId(true)];
  const revision = storedRevision(collection);
  return [
    problemResponse({
      collection,
      key: 'replace-invalid',
      problem: invalidDocument(
        'O corpo não tem os campos obrigatórios do documento.',
      ),
      rules: [...replace, bodyFailsEnvelope(collection.schema)],
    }),
    problemResponse({
      collection,
      key: 'replace-other-id',
      problem: invalidDocument('O id do corpo não é o do endereço.'),
      rules: [...replace, templateIsFalse(`eq ${BODY_ID} ${URL_ID}`)],
    }),
    problemResponse({
      collection,
      key: 'replace-revision',
      problem: invalidDocument(
        `A revision do corpo precisa ser a revisão lida mais 1; a gravada é ${REVISION_MARK}.`,
      ),
      rules: [
        ...replace,
        templateIsFalse(`eq (bodyRaw 'revision') (add (${revision}) 1)`),
      ],
    }),
  ];
}

function createGuards(collection) {
  const create = [methodIs('post')];
  return [
    problemResponse({
      collection,
      key: 'create-invalid',
      problem: invalidDocument(
        'O corpo não tem os campos obrigatórios do documento.',
      ),
      rules: [...create, bodyFailsEnvelope(collection.schema)],
    }),
    problemResponse({
      collection,
      key: 'create-duplicate',
      problem: invalidDocument('Já existe documento com este id.'),
      rules: [
        ...create,
        documentExists({ bucket: collection.path, id: BODY_ID, exists: true }),
      ],
    }),
    problemResponse({
      collection,
      key: 'create-revision',
      problem: invalidDocument('O documento novo começa com revision 1.'),
      rules: [...create, bodyFieldIsNot({ field: 'revision', value: '1' })],
    }),
  ];
}

function seedGuards(collection) {
  return [
    problemResponse({
      collection,
      key: 'seed-invalid',
      problem: invalidDocument(
        'A coleção precisa ser uma lista de documentos com os campos obrigatórios.',
      ),
      rules: [
        methodIs('put'),
        urlHasId(false),
        bodyFailsEnvelope(`${collection.schema}List`),
      ],
    }),
  ];
}

// NOTE: a ordem é a das checagens do contrato: cenário de falha, operação fora
// do contrato, 428, 404, 412 e só então o corpo (400 e 422).
export function refusals(collection) {
  return [
    ...scenarioFailures(collection),
    ...outOfContract(collection),
    ...preconditions(collection),
    ...malformedBody(collection),
    ...replaceGuards(collection),
    ...createGuards(collection),
    ...seedGuards(collection),
  ];
}
