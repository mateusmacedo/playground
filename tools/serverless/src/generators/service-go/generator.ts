import { join } from 'node:path';

import {
  formatFiles,
  type GeneratorCallback,
  generateFiles,
  type Tree,
} from '@nx/devkit';

import {
  AWS_LAMBDA_GO_API_PROXY_VERSION,
  AWS_LAMBDA_GO_VERSION,
  GO_ARCHITECTURES,
  GO_RUNTIME,
  GO_TO_AWS_ARCH,
  SERVERLESS_LOCALSTACK_VERSION,
  SERVERLESS_VERSION,
} from '../../shared/constants.js';
import {
  addRootDevDependencies,
  addServiceProject,
  normalizeServiceOptions,
} from '../shared/service-project.js';
import { goModTidyTask } from './go-mod-tidy.js';
import type { ServiceGoGeneratorSchema } from './schema.js';

const templatesDir = join(import.meta.dirname, 'files');

export async function serviceGoGenerator(
  tree: Tree,
  options: ServiceGoGeneratorSchema,
): Promise<GeneratorCallback> {
  const service = normalizeServiceOptions(tree, options, 'go');
  const architecture = options.architecture ?? 'arm64';
  if (!GO_ARCHITECTURES.includes(architecture)) {
    throw new Error(
      `Arquitetura "${architecture}" não suportada. Use: ${GO_ARCHITECTURES.join(', ')}.`,
    );
  }

  addServiceProject(tree, service);

  const model = {
    ...service.templateModel,
    runtime: GO_RUNTIME,
    goVersion: options.goVersion ?? '1.26',
    modulePath: options.modulePath ?? service.projectRoot,
    awsLambdaGoVersion: AWS_LAMBDA_GO_VERSION,
    awsLambdaGoApiProxyVersion: AWS_LAMBDA_GO_API_PROXY_VERSION,
    awsArchitecture: GO_TO_AWS_ARCH[architecture],
  };
  generateFiles(tree, join(templatesDir, 'common'), service.projectRoot, model);
  generateFiles(
    tree,
    join(templatesDir, service.type),
    service.projectRoot,
    model,
  );

  const installTask = addRootDevDependencies(tree, options, {
    serverless: SERVERLESS_VERSION,
    'serverless-localstack': SERVERLESS_LOCALSTACK_VERSION,
  });

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  const tidyTask = options.skipGoModTidy
    ? undefined
    : goModTidyTask(join(tree.root, service.projectRoot));

  return async () => {
    await installTask?.();
    await tidyTask?.();
  };
}

export default serviceGoGenerator;
