import { join } from 'node:path';
import { getReadyUrl, workspaceRoot } from '@nx/devkit';
import { nxE2EPreset } from '@nx/playwright/preset';
import { defineConfig, devices } from '@playwright/test';

import { MOCK_ADDRESS } from './src/support/mock-address.ts';

const isCI = !!process.env.CI;
// WHY: por padrão só o Chromium, que é o mais barato; E2E_ALL_BROWSERS=1 liga
// firefox e webkit (release e `pnpm e2e:full`). A variável entra no hash do Nx.
const allBrowsers = process.env.E2E_ALL_BROWSERS === '1';
// getReadyUrl moves the address to the port the server task reported.
const webServerAddress = getReadyUrl(
  isCI ? 'http://localhost:3000' : 'http://127.0.0.1:3000',
);

// For CI, you may want to set BASE_URL to the deployed application.
const baseURL = process.env.BASE_URL || webServerAddress;
const WEB_SERVER_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import 'dotenv/config';

/**
 * See https://playwright.dev/docs/test-configuration.
 *
 * Generated as a .mts file so Node forces ESM regardless of workspace
 * `type`. Playwright routes `.mts` through its ESM loader (dynamic import,
 * bypassing the pirates CJS-compile path), and Nx's native TS strip loads
 * `.mts` directly. Playwright's configLoader auto-discovers
 * `playwright.config.mts` via its extension list
 * (.ts/.js/.mts/.mjs/.cts/.cjs).
 */
export default defineConfig({
  ...nxE2EPreset(import.meta.dirname, { testDir: './src' }),
  // WHY: o mock da API guarda um estado só, e cada teste o devolve aos dados
  // iniciais; com dois testes ao mesmo tempo, um apagaria os dados do outro.
  workers: 1,
  // WHY: falha uma vez, antes do primeiro teste, quando o mock não está no ar.
  globalSetup: './src/support/global-setup.ts',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    baseURL,
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },
  webServer: {
    // WHY: localmente o `next dev` sobe direto, sem o Nx no meio. O `nx run`
    // abre o `next dev` num grupo de processos próprio, e o Playwright, que
    // encerra só o grupo que ele criou, deixava o painel ocupando a porta 3000
    // depois da rodada.
    command: isCI
      ? 'pnpm exec nx run backoffice:start'
      : 'node_modules/.bin/next dev',
    url: webServerAddress,
    reuseExistingServer: true,
    cwd: isCI ? workspaceRoot : join(workspaceRoot, 'apps/backoffice'),
    // WHY: o painel do e2e fala com a API, servida pelo mock. A variável entra
    // no bundle no build, então quem sobe o servidor é o próprio Playwright:
    // com `env` aqui, o Nx não infere o `backoffice:dev` como dependência do
    // `e2e`, que subiria o painel sem ela.
    env: { NEXT_PUBLIC_API_URL: MOCK_ADDRESS.apiUrl },
    // WHY: no CI o `backoffice:start` constrói o painel antes de subir, e o
    // padrão de 60 s do Playwright não cobre o build.
    timeout: WEB_SERVER_TIMEOUT_MS,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    ...(allBrowsers
      ? [
          {
            name: 'firefox',
            use: { ...devices['Desktop Firefox'] },
          },
          {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] },
          },
        ]
      : []),
  ],
});
