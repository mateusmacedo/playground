import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { type ExecutorContext, logger } from '@nx/devkit';

import { readServerlessManifest } from '../../core/serverless-manifest.js';
import type { ExecutorResult } from '../../shared/types.js';
import { validateServerlessProject } from './rules.js';
import type { ValidateExecutorSchema } from './schema.js';

export default async function validateExecutor(
  options: ValidateExecutorSchema,
  context: ExecutorContext,
): Promise<ExecutorResult> {
  const projectName = context.projectName ?? '';
  const projectRoot =
    context.projectsConfigurations.projects[projectName]?.root;
  if (projectRoot === undefined) {
    logger.error(`Projeto "${projectName}" não encontrado no workspace.`);
    return { success: false };
  }

  const configPath = options.configPath ?? 'serverless.yml';
  const absProjectRoot = join(context.root, projectRoot);
  if (!existsSync(join(absProjectRoot, configPath))) {
    logger.error(`Manifesto ${configPath} não encontrado em ${projectRoot}.`);
    return { success: false };
  }

  const report = validateServerlessProject({
    manifest: readServerlessManifest(
      context.root,
      join(projectRoot, configPath),
    ),
    stack: options.stack,
    operation: options.operation ?? 'deploy',
    stage: options.stage,
    absProjectRoot,
    projectRoot,
  });

  for (const warning of report.warnings) {
    logger.warn(warning);
  }
  for (const error of report.errors) {
    logger.error(error);
  }

  return { success: report.errors.length === 0 };
}
