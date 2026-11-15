import { join } from 'node:path';

import {
  formatFiles,
  type GeneratorCallback,
  generateFiles,
  joinPathFragments,
  type Tree,
} from '@nx/devkit';

import {
  AWS_LAMBDA_TYPES_VERSION,
  SERVERLESS_LOCALSTACK_VERSION,
  SERVERLESS_VERSION,
} from '../../shared/constants.js';
import {
  addRootDevDependencies,
  addServiceProject,
  normalizeServiceOptions,
} from '../shared/service-project.js';
import type { ServiceTsGeneratorSchema } from './schema.js';

const templatesDir = join(import.meta.dirname, 'files');

export async function serviceTsGenerator(
  tree: Tree,
  options: ServiceTsGeneratorSchema,
): Promise<GeneratorCallback> {
  const service = normalizeServiceOptions(tree, options, 'typescript');
  const runtime = options.runtime ?? 'nodejs24.x';
  if (!runtime.startsWith('nodejs')) {
    throw new Error(
      `Runtime "${runtime}" inválido para TypeScript; use nodejs*.`,
    );
  }

  addServiceProject(
    tree,
    service,
    joinPathFragments(service.projectRoot, 'src'),
  );

  const model = { ...service.templateModel, runtime };
  generateFiles(tree, join(templatesDir, 'common'), service.projectRoot, model);
  generateFiles(
    tree,
    join(templatesDir, service.type),
    service.projectRoot,
    model,
  );

  const installTask = addRootDevDependencies(tree, options, {
    '@types/aws-lambda': AWS_LAMBDA_TYPES_VERSION,
    serverless: SERVERLESS_VERSION,
    'serverless-localstack': SERVERLESS_LOCALSTACK_VERSION,
  });

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return async () => {
    await installTask?.();
  };
}

export default serviceTsGenerator;
