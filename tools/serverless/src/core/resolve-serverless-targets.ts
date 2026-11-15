import { join } from 'node:path';

import { resolveGoTargets } from '../languages/go/resolve-go-targets.js';
import { resolveJavaTargets } from '../languages/java/resolve-java-targets.js';
import { resolveTypescriptTargets } from '../languages/typescript/resolve-typescript-targets.js';
import { detectServerlessLanguage } from './detect-serverless-project.js';
import { readServerlessManifest } from './serverless-manifest.js';
import type { ResolvedTargets, TargetContext } from './types.js';

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

  const targets =
    language === 'typescript'
      ? resolveTypescriptTargets(ctx)
      : language === 'go'
        ? resolveGoTargets(ctx, manifest, absProjectRoot)
        : resolveJavaTargets(ctx, manifest);

  return {
    targets,
    metadata: {
      technologies: ['serverless', language],
      targetGroups: { Serverless: Object.keys(targets) },
    },
  };
}
