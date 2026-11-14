import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { GRADLE_BUILD_FILES, QUARKUS_PLUGIN_ID } from '../shared/constants.js';
import type { Stack } from '../shared/types.js';
import type { DetectionResult, ServerlessManifest } from './types.js';

const STACKS: readonly Stack[] = ['typescript', 'go', 'java'];

const isStack = (value: string | undefined): value is Stack =>
  value !== undefined && (STACKS as readonly string[]).includes(value);

export function isQuarkusGradleProject(absProjectRoot: string): boolean {
  return GRADLE_BUILD_FILES.some((file) => {
    const path = join(absProjectRoot, file);
    return (
      existsSync(path) &&
      readFileSync(path, 'utf-8').includes(QUARKUS_PLUGIN_ID)
    );
  });
}

export function detectServerlessLanguage(
  absProjectRoot: string,
  projectRoot: string,
  manifest: ServerlessManifest,
): DetectionResult {
  if (isStack(manifest.language)) {
    return { language: manifest.language, source: 'manifest' };
  }

  const indicators: Record<Stack, boolean> = {
    typescript: existsSync(join(absProjectRoot, 'tsconfig.json')),
    go: existsSync(join(absProjectRoot, 'go.mod')),
    java: isQuarkusGradleProject(absProjectRoot),
  };
  const found = STACKS.filter((stack) => indicators[stack]);

  if (found.length === 1) {
    return { language: found[0], source: 'filesystem' };
  }

  const detail =
    found.length > 1
      ? `Há indicadores de mais de uma linguagem (${found.join(', ')}).`
      : 'Não há tsconfig.json, go.mod nem build.gradle(.kts) com Quarkus no diretório.';
  throw new Error(
    `[nx-serverless] Não foi possível determinar a linguagem do projeto em "${projectRoot}". ` +
      `${detail} Declare custom.nxServerless.language (${STACKS.join(', ')}) no serverless.yml.`,
  );
}
