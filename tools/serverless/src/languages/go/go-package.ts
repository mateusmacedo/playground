import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { trimTrailingSlashes } from '../../shared/normalize.js';

const LEADING_DOT_SLASH = /^\.\//;

export function normalizeGoPackage(goPackage: string): string {
  return trimTrailingSlashes(goPackage.trim().replace(LEADING_DOT_SLASH, ''));
}

export function findCmdPackages(absProjectRoot: string): string[] {
  const cmdDir = join(absProjectRoot, 'cmd');
  if (!existsSync(cmdDir)) {
    return [];
  }
  return readdirSync(cmdDir, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() && existsSync(join(cmdDir, entry.name, 'main.go')),
    )
    .map((entry) => `cmd/${entry.name}`);
}

// WHY: com um só cmd/<nome>/main.go o pacote é inequívoco; com vários, o
// manifesto precisa declarar custom.nxServerless.goPackage.
export function resolveGoPackage(
  absProjectRoot: string,
  declared: string | undefined,
): string | undefined {
  if (declared) {
    return normalizeGoPackage(declared);
  }
  if (existsSync(join(absProjectRoot, 'main.go'))) {
    return undefined;
  }
  const candidates = findCmdPackages(absProjectRoot);
  return candidates.length === 1 ? candidates[0] : undefined;
}
