import { accessSync, constants, statSync } from 'node:fs';
import { delimiter, isAbsolute, join } from 'node:path';

const OTHERS_WRITE_BIT = 0o002;

export type ResolveExecutableOptions = {
  name: string;
  searchPath?: string;
  platform?: NodeJS.Platform;
  pathExt?: string;
};

// WHY: procurar o binário só em pastas absolutas que nem todo usuário consegue
// gravar impede que um executável plantado em `.`, numa entrada vazia do PATH
// ou numa pasta gravável por todos seja executado no lugar do verdadeiro.
export function resolveExecutable({
  name,
  searchPath = process.env.PATH ?? '',
  platform = process.platform,
  pathExt = process.env.PATHEXT ?? '.EXE',
}: ResolveExecutableOptions): string | undefined {
  const fileNames = executableFileNames({ name, platform, pathExt });
  for (const directory of searchPath.split(delimiter)) {
    if (!isTrustedDirectory({ directory, platform })) {
      continue;
    }
    for (const fileName of fileNames) {
      const candidate = join(directory, fileName);
      if (isExecutableFile(candidate)) {
        return candidate;
      }
    }
  }
  return undefined;
}

function executableFileNames({
  name,
  platform,
  pathExt,
}: {
  name: string;
  platform: NodeJS.Platform;
  pathExt: string;
}): string[] {
  if (platform !== 'win32') {
    return [name];
  }
  const extensions = pathExt.split(';').filter((extension) => extension !== '');
  return extensions.map((extension) => `${name}${extension.toLowerCase()}`);
}

function isTrustedDirectory({
  directory,
  platform,
}: {
  directory: string;
  platform: NodeJS.Platform;
}): boolean {
  if (!isAbsolute(directory)) {
    return false;
  }
  let mode: number;
  try {
    mode = statSync(directory).mode;
  } catch {
    // WHY: pasta do PATH que não existe só não tem o binário; seguir para a
    // próxima é o comportamento da busca do próprio sistema.
    return false;
  }
  // NOTE: no Windows os bits de permissão do Node não refletem as ACLs, então
  // só a exigência de caminho absoluto vale lá.
  if (platform === 'win32') {
    return true;
  }
  return (mode & OTHERS_WRITE_BIT) === 0;
}

function isExecutableFile(path: string): boolean {
  try {
    if (!statSync(path).isFile()) {
      return false;
    }
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    // WHY: arquivo ausente ou sem permissão de execução não é candidato.
    return false;
  }
}
