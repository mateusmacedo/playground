import { join } from 'node:path';

import { type ExecutorContext, logger } from '@nx/devkit';

import { buildGoLambdaArtifact } from '../../languages/go/build-go-lambda-artifact.js';
import type { ExecutorResult } from '../../shared/types.js';
import type { GoBuildExecutorSchema } from './schema.js';

export default async function goBuildExecutor(
  options: GoBuildExecutorSchema,
  context: ExecutorContext,
): Promise<ExecutorResult> {
  const projectName = context.projectName ?? '';
  const projectRoot =
    context.projectsConfigurations.projects[projectName]?.root;
  if (projectRoot === undefined) {
    logger.error(`Projeto "${projectName}" não encontrado no workspace.`);
    return { success: false };
  }

  return buildGoLambdaArtifact({
    absProjectRoot: join(context.root, projectRoot),
    architecture: options.architecture ?? 'arm64',
    trimpath: options.trimpath ?? true,
    ldflags: options.ldflags ?? '-s -w',
    tags: options.tags ?? 'lambda.norpc',
    packagePath: options.packagePath,
  });
}
