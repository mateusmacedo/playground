import { defineConfig } from 'vitest/config';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/tools/serverless',
  test: {
    name: 'nx-serverless',
    watch: false,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
      // NOTE: cobertura só quando pedida (VITEST_COVERAGE=1 ou `--coverage`),
      // como no backoffice; o release.yml e o check:full ligam pela variável.
      enabled: process.env.VITEST_COVERAGE === '1',
      // WHY: sem `include`, o v8 só reporta os arquivos que algum teste carregou
      // e o que nenhum teste toca some do percentual, que o Sonar conta como 0%.
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.spec.ts',
        'src/**/*.d.ts',
        'src/generators/*/files/**',
      ],
      // WHY: a meta do projeto é cobertura acima de 90% em linhas e ramos.
      thresholds: { lines: 90.01, branches: 90.01 },
    },
  },
}));
