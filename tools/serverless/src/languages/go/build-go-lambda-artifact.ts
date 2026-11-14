import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, posix } from 'node:path';

import { logger } from '@nx/devkit';

import {
  GO_ARCHITECTURES,
  LAMBDA_BINARY_NAME,
  LAMBDA_OUTPUT_DIR,
} from '../../shared/constants.js';
import type { ExecutorResult, GoArch } from '../../shared/types.js';
import { createZip } from './zip.js';

export type GoBuildOptions = {
  absProjectRoot: string;
  architecture: string;
  trimpath: boolean;
  ldflags: string;
  tags: string;
  packagePath?: string;
};

const fail = (message: string): ExecutorResult => {
  logger.error(message);
  return { success: false };
};

const isGoArch = (value: string): value is GoArch =>
  (GO_ARCHITECTURES as readonly string[]).includes(value);

export function normalizePackagePath(
  packagePath: string,
): { path: string } | { error: string } {
  const trimmed = packagePath.trim();
  if (trimmed === '' || trimmed === '.') {
    return {
      error: `packagePath não pode ser vazio nem ".", recebido "${packagePath}".`,
    };
  }
  if (
    trimmed.startsWith('/') ||
    /^[A-Za-z]:/.test(trimmed) ||
    trimmed.includes('\\')
  ) {
    return {
      error: `packagePath deve ser um caminho POSIX relativo, recebido "${packagePath}".`,
    };
  }
  if (trimmed.split('/').includes('..')) {
    return {
      error: `packagePath não pode conter "..", recebido "${packagePath}".`,
    };
  }
  const normalized = posix.normalize(trimmed).replace(/\/$/, '');
  if (normalized === '.') {
    return {
      error: `packagePath não pode apontar para a raiz do projeto, recebido "${packagePath}".`,
    };
  }
  return { path: normalized };
}

export function goBuildArgs(
  options: Pick<GoBuildOptions, 'trimpath' | 'ldflags' | 'tags'>,
  binaryPath: string,
  packagePath: string | undefined,
): string[] {
  // WHY: -buildvcs=false tira o estado do git do binário; sem isso o artefato
  // muda a cada commit e o cache do build nunca reaproveita.
  const args = ['build', '-buildvcs=false'];
  if (options.trimpath) {
    args.push('-trimpath');
  }
  args.push(
    '-tags',
    options.tags,
    '-ldflags',
    options.ldflags,
    '-o',
    binaryPath,
  );
  if (packagePath) {
    args.push(`./${packagePath}`);
  }
  return args;
}

// WHY: um zip escrito pela metade (disco cheio, Ctrl+C) seria tomado como
// artefato válido pelo Serverless; escrever em `.tmp` e renomear (atômico no
// mesmo diretório) mantém o artefato anterior intacto até o novo estar inteiro.
export function writeFileAtomic(path: string, data: Buffer): void {
  const tmpPath = `${path}.tmp`;
  writeFileSync(tmpPath, data);
  renameSync(tmpPath, path);
}

export function buildGoLambdaArtifact(options: GoBuildOptions): ExecutorResult {
  const { absProjectRoot, architecture } = options;

  if (!isGoArch(architecture)) {
    return fail(
      `Arquitetura "${architecture}" inválida. Use: ${GO_ARCHITECTURES.join(', ')}.`,
    );
  }

  if (spawnSync('go', ['version'], { stdio: 'ignore' }).status !== 0) {
    return fail('Go não está instalado ou não está no PATH.');
  }

  if (!existsSync(join(absProjectRoot, 'go.mod'))) {
    return fail(`go.mod não encontrado em ${absProjectRoot}.`);
  }

  let packagePath: string | undefined;
  if (options.packagePath !== undefined) {
    const result = normalizePackagePath(options.packagePath);
    if ('error' in result) {
      return fail(result.error);
    }
    const absPackagePath = join(absProjectRoot, result.path);
    if (
      !existsSync(absPackagePath) ||
      !statSync(absPackagePath).isDirectory()
    ) {
      return fail(`Diretório de packagePath não encontrado: ${result.path}.`);
    }
    packagePath = result.path;
  }

  const outputDir = join(absProjectRoot, LAMBDA_OUTPUT_DIR);
  const binaryPath = join(outputDir, LAMBDA_BINARY_NAME);
  mkdirSync(outputDir, { recursive: true });

  const build = spawnSync('go', goBuildArgs(options, binaryPath, packagePath), {
    cwd: absProjectRoot,
    env: {
      ...process.env,
      GOOS: 'linux',
      GOARCH: architecture,
      CGO_ENABLED: '0',
    },
    stdio: 'inherit',
  });
  if (build.status !== 0 || build.signal) {
    const reason = build.signal
      ? `interrompido pelo sinal ${build.signal}`
      : `código de saída ${build.status}`;
    return fail(`go build falhou (${reason}).`);
  }

  writeFileAtomic(
    `${binaryPath}.zip`,
    createZip([
      { name: LAMBDA_BINARY_NAME, data: readFileSync(binaryPath), mode: 0o755 },
    ]),
  );
  logger.info(
    `Artefato ${LAMBDA_OUTPUT_DIR}/${LAMBDA_BINARY_NAME}.zip gerado para linux/${architecture}.`,
  );
  return { success: true };
}
