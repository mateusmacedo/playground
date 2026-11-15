import { spawnSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

import { PROD_DEPLOY_GUARD } from './target-builders.js';

// WHY: o spawn ignora chave com valor `undefined`, então o teste não herda
// o CI nem a liberação do ambiente em que roda.
const runGuard = (extraEnv: NodeJS.ProcessEnv) =>
  spawnSync(PROD_DEPLOY_GUARD, {
    shell: true,
    encoding: 'utf-8',
    env: {
      ...process.env,
      CI: undefined,
      NX_SERVERLESS_ALLOW_PROD_DEPLOY: undefined,
      ...extraEnv,
    },
  });

describe('PROD_DEPLOY_GUARD', () => {
  it('bloqueia o deploy fora do pipeline e diz qual é o próximo passo', () => {
    const result = runGuard({});

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Deploy em prod bloqueado pelo plugin');
    expect(result.stderr).toContain('CI=true');
    expect(result.stderr).toContain('NX_SERVERLESS_ALLOW_PROD_DEPLOY=1');
  });

  it.each([{ CI: 'true' }, { NX_SERVERLESS_ALLOW_PROD_DEPLOY: '1' }])(
    'libera o deploy com %o',
    (env) => {
      expect(runGuard(env).status).toBe(0);
    },
  );

  it.each([
    { CI: 'false' },
    { CI: '1' },
    { NX_SERVERLESS_ALLOW_PROD_DEPLOY: 'true' },
    { NX_SERVERLESS_ALLOW_PROD_DEPLOY: '' },
  ])('só aceita os valores documentados: %o continua bloqueado', (env) => {
    expect(runGuard(env).status).toBe(1);
  });
});
