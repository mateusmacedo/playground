import { join } from 'node:path';

import type { TargetConfiguration } from '@nx/devkit';

import { resolveGoTargets } from '../languages/go/resolve-go-targets.js';
import { resolveJavaTargets } from '../languages/java/resolve-java-targets.js';
import { resolveTypescriptTargets } from '../languages/typescript/resolve-typescript-targets.js';
import type { Stack } from '../shared/types.js';
import { detectServerlessLanguage } from './detect-serverless-project.js';
import { readServerlessManifest } from './serverless-manifest.js';
import type {
  ResolvedTargets,
  ServerlessManifest,
  TargetContext,
} from './types.js';

function resolveTargetsFor({
  language,
  ctx,
  manifest,
  absProjectRoot,
}: {
  language: Stack;
  ctx: TargetContext;
  manifest: ServerlessManifest;
  absProjectRoot: string;
}): Record<string, TargetConfiguration> {
  if (language === 'typescript') {
    return resolveTypescriptTargets(ctx);
  }
  if (language === 'go') {
    return resolveGoTargets(ctx, manifest, absProjectRoot);
  }
  return resolveJavaTargets(ctx, manifest);
}

export function resolveServerlessTargets(
  workspaceRoot: string,
  configFilePath: string,
  ctx: TargetContext,
): ResolvedTargets {
  const manifest = readServerlessManifest(workspaceRoot, configFilePath);
  const absProjectRoot = join(workspaceRoot, ctx.projectRoot);
  const { language } = detectServerlessLanguage(
    absProjectRoot,
    ctx.projectRoot,
    manifest,
  );

  const targets = resolveTargetsFor({
    language,
    ctx,
    manifest,
    absProjectRoot,
  });

  return {
    targets,
    metadata: {
      technologies: ['serverless', language],
      targetGroups: { Serverless: Object.keys(targets) },
    },
  };
}
