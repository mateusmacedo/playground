import { join } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/backoffice',
  resolve: {
    alias: {
      '@': join(import.meta.dirname, './src'),
    },
  },
  plugins: [react()],
  test: {
    name: 'backoffice',
    watch: false,
    // WHY: sem limite o Vitest usa todos os núcleos; com 3 tarefas do Nx em
    // paralelo isso satura a máquina. VITEST_MAX_WORKERS sobrescreve este valor.
    maxWorkers: 2,
    globals: true,
    environment: 'jsdom',
    include: [
      '{src,app,pages,specs}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
    ],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
      // NOTE: cobertura só quando pedida (VITEST_COVERAGE=1 ou `--coverage`);
      // a variável entra no hash do Nx via targetDefaults.test.inputs.
      enabled: process.env.VITEST_COVERAGE === '1',
      // WHY: sem `include` o v8 só relata os arquivos que algum teste importou, e um arquivo nunca testado some do
      // total; assim o número local fica igual ao do Sonar, que conta todo o `src` do painel.
      include: ['src/**/*.{ts,tsx}'],
      // NOTE: espelha as exclusões do `sonar-project.properties` (testes e arquivos de configuração), para o número
      // local e o do Sonar medirem o mesmo conjunto de arquivos.
      exclude: [
        '**/*.spec.ts',
        '**/*.spec.tsx',
        '**/*.d.ts',
        '**/*.config.*',
        '**/test-setup.ts',
      ],
      // WHY: a meta do projeto é cobertura acima de 90% em linhas e ramos.
      thresholds: { lines: 90.01, branches: 90.01 },
    },
  },
}));
