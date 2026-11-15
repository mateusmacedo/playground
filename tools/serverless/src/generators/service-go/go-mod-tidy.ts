import { spawnSync } from 'node:child_process';

import { type GeneratorCallback, logger } from '@nx/devkit';

import { resolveExecutable } from '../../shared/resolve-executable.js';

// NOTE: o go.sum só nasce com o `go mod tidy`; sem Go confiável no PATH, ou se
// o comando falhar, o gerador avisa e o serviço continua gerado.
export function goModTidyTask(absProjectRoot: string): GeneratorCallback {
  return () => {
    const goBinary = resolveExecutable({ name: 'go' });
    const result =
      goBinary === undefined
        ? undefined
        : spawnSync(goBinary, ['mod', 'tidy'], {
            cwd: absProjectRoot,
            stdio: 'inherit',
          });
    if (result?.status !== 0) {
      logger.warn(
        `Não foi possível rodar "go mod tidy" em ${absProjectRoot}; rode manualmente para gerar o go.sum.`,
      );
    }
  };
}
