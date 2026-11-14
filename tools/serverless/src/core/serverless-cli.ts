import { existsSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';

const SERVERLESS_PACKAGE_DIR = 'node_modules/serverless';

type PackageJsonWithBin = {
  bin?: string | Record<string, string>;
};

// WHY: chamar o bin com `node` evita o `pnpm exec`, que roda o check de
// dependências (e às vezes um install) a cada comando. O caminho usa o link
// estável em node_modules, não o diretório versionado do .pnpm.
export function detectServerlessBin(workspaceRoot: string): string | undefined {
  const packageJsonPath = join(
    workspaceRoot,
    SERVERLESS_PACKAGE_DIR,
    'package.json',
  );
  if (!existsSync(packageJsonPath)) {
    return undefined;
  }
  const { bin } = JSON.parse(
    readFileSync(packageJsonPath, 'utf-8'),
  ) as PackageJsonWithBin;
  const entry = typeof bin === 'string' ? bin : (bin?.serverless ?? bin?.sls);
  return entry ? posix.join(SERVERLESS_PACKAGE_DIR, entry) : undefined;
}

export function resolveServerlessCommand(
  projectRoot: string,
  serverlessBin: string | undefined,
  override: string | undefined,
): string {
  if (override) {
    return override;
  }
  if (!serverlessBin) {
    return 'serverless';
  }
  const depth = projectRoot
    .split('/')
    .filter((segment) => segment !== '' && segment !== '.').length;
  const toWorkspaceRoot = '../'.repeat(depth);
  return `node ${toWorkspaceRoot}${serverlessBin}`;
}
