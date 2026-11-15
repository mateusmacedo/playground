import { defineConfig } from 'vitest/config';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/tools/ai',
  test: {
    name: 'ai-instructions',
    watch: false,
    environment: 'node',
    include: ['*.spec.mjs'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
      // NOTE: cobertura só quando pedida (VITEST_COVERAGE=1 ou `--coverage`);
      // a variável entra no hash do Nx via targetDefaults.test.inputs.
      enabled: process.env.VITEST_COVERAGE === '1',
      include: ['check-instructions.mjs'],
      // WHY: a meta do projeto é cobertura acima de 90% em linhas e ramos.
      thresholds: { lines: 90.01, branches: 90.01 },
    },
  },
}));
