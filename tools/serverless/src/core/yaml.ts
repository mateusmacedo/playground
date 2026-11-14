import { createRequire } from 'node:module';

type YamlDocument = {
  errors: readonly unknown[];
  toJS: () => unknown;
};

type YamlModule = {
  parseDocument: (source: string) => YamlDocument;
};

const requireFromHere = createRequire(import.meta.url);

// WHY: o `yaml` chega ao workspace como dependência do `nx`, e o pnpm não o
// expõe para quem não o declara. Enquanto o pacote não estiver declarado na
// raiz, resolvemos a cópia do `nx` para não exigir instalação nova.
function loadYaml(): YamlModule {
  try {
    return requireFromHere('yaml') as YamlModule;
  } catch {
    const nxPackageJson = requireFromHere.resolve('nx/package.json');
    return createRequire(nxPackageJson)('yaml') as YamlModule;
  }
}

let yamlModule: YamlModule | undefined;

export const isPlainObject = (
  value: unknown,
): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function parseYamlObject(raw: string): Record<string, unknown> | null {
  yamlModule ??= loadYaml();
  // WHY: parseDocument separa erros de sintaxe de avisos; tags do
  // CloudFormation (`!Ref`, `!GetAtt`) geram só aviso e são legítimas aqui.
  const document = yamlModule.parseDocument(raw);
  if (document.errors.length > 0) {
    return null;
  }
  const parsed = document.toJS();
  return isPlainObject(parsed) ? parsed : null;
}

export function getObject(
  value: unknown,
  key: string,
): Record<string, unknown> | undefined {
  if (!isPlainObject(value)) {
    return undefined;
  }
  const child = value[key];
  return isPlainObject(child) ? child : undefined;
}

export function getString(value: unknown, key: string): string | undefined {
  if (!isPlainObject(value)) {
    return undefined;
  }
  const child = value[key];
  return typeof child === 'string' ? child : undefined;
}

export function hasKey(value: unknown, key: string): boolean {
  return isPlainObject(value) && Object.hasOwn(value, key);
}
