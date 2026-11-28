const ITEM_SUFFIX = '/{id}';

// NOTE: operações que uma rota CRUD do Mockoon atende, na coleção e no item.
const CRUD_METHODS = {
  collection: ['get', 'post', 'put', 'patch', 'delete'],
  item: ['get', 'put', 'patch', 'delete'],
};

const REFUSAL_STATUS = 405;

function splitPath(path) {
  const item = path.endsWith(ITEM_SUFFIX);
  const base = item ? path.slice(0, -ITEM_SUFFIX.length) : path;
  return { endpoint: base.replace(/^\//, ''), item };
}

function ruleMatches({ rule, method, item }) {
  let matches = false;
  if (rule.target === 'method') {
    matches = new RegExp(`^(?:${rule.value})$`).test(method);
  } else if (rule.target === 'params') {
    matches = item;
  }
  return rule.invert ? !matches : matches;
}

function refuses({ response, method, item }) {
  if (response.statusCode !== REFUSAL_STATUS) {
    return false;
  }
  return response.rules.every((rule) => ruleMatches({ rule, method, item }));
}

// NOTE: diz se o ambiente do Mockoon atende a operação do contrato: existe a
// rota, ela aceita o método e nenhuma resposta de recusa (405) casa com ele.
export function servesOperation({ environment, operation }) {
  const { endpoint, item } = splitPath(operation.path);
  const { method } = operation;
  for (const route of environment.routes) {
    if (route.endpoint !== endpoint) {
      continue;
    }
    if (route.type !== 'crud') {
      return !item && route.method === method;
    }
    const accepted = CRUD_METHODS[item ? 'item' : 'collection'];
    if (!accepted.includes(method)) {
      return false;
    }
    return !route.responses.some((response) =>
      refuses({ response, method, item }),
    );
  }
  return false;
}
