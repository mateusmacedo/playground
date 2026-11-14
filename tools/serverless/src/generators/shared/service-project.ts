import {
  addDependenciesToPackageJson,
  addProjectConfiguration,
  type GeneratorCallback,
  getProjects,
  joinPathFragments,
  offsetFromRoot,
  type Tree,
} from '@nx/devkit';

import {
  DEFAULT_SERVICES_DIRECTORY,
  QUEUE_OWNERSHIPS,
  SERVICE_TYPES,
  SSM_PREFIX,
} from '../../shared/constants.js';
import {
  assertRelativeProjectRoot,
  normalizeProjectRoot,
  normalizeServiceName,
} from '../../shared/normalize.js';
import type { QueueOwnership, ServiceType, Stack } from '../../shared/types.js';

export type BaseServiceSchema = {
  name: string;
  type?: ServiceType;
  queue?: QueueOwnership;
  queueParam?: string;
  directory?: string;
  domain?: string;
  tags?: string;
  memorySize?: number;
  timeout?: number;
  skipFormat?: boolean;
  skipPackageJson?: boolean;
};

export type NormalizedService = {
  serviceName: string;
  type: ServiceType;
  projectRoot: string;
  tags: string[];
  templateModel: Record<string, unknown>;
};

// WHY: o contrato SSM é /<stage>/<região>/<domínio>/<recurso>/<atributo>; o
// template acrescenta o atributo (arn, url), então aqui vêm dois segmentos.
const QUEUE_PARAM =
  /^[a-z][a-z0-9]*(-[a-z0-9]+)*\/[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

const STACK_TAG: Readonly<Record<Stack, string>> = {
  typescript: 'stack:ts',
  go: 'stack:go',
  java: 'stack:java',
};

const TYPE_DESCRIPTION: Readonly<Record<ServiceType, string>> = {
  http: 'HTTP acionado pelo API Gateway (HTTP API)',
  sqs: 'consumidor de fila SQS',
  scheduled: 'agendado pelo EventBridge',
};

function parseExtraTags(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

export function normalizeServiceOptions(
  tree: Tree,
  options: BaseServiceSchema,
  stack: Stack,
): NormalizedService {
  const type = options.type ?? 'http';
  if (!SERVICE_TYPES.includes(type)) {
    throw new Error(
      `Tipo "${type}" não suportado. Use: ${SERVICE_TYPES.join(', ')}.`,
    );
  }

  if (options.queue !== undefined && type !== 'sqs') {
    throw new Error('A opção "queue" só se aplica ao tipo sqs.');
  }
  const queue = options.queue ?? 'external';
  if (!QUEUE_OWNERSHIPS.includes(queue)) {
    throw new Error(
      `Valor "${queue}" inválido para "queue". Use: ${QUEUE_OWNERSHIPS.join(', ')}.`,
    );
  }

  if (
    options.queueParam !== undefined &&
    (type !== 'sqs' || queue !== 'external')
  ) {
    throw new Error(
      'A opção "queueParam" só se aplica ao tipo sqs com queue external.',
    );
  }
  if (
    options.queueParam !== undefined &&
    !QUEUE_PARAM.test(options.queueParam)
  ) {
    throw new Error(
      `queueParam "${options.queueParam}" inválido. Use <domínio>/<recurso> em kebab-case, por exemplo shared/sample-events-queue.`,
    );
  }

  const serviceName = normalizeServiceName(options.name);
  const projectRoot = normalizeProjectRoot(
    options.directory ??
      joinPathFragments(DEFAULT_SERVICES_DIRECTORY, serviceName),
  );
  assertRelativeProjectRoot(projectRoot);

  for (const [name, project] of getProjects(tree)) {
    if (name === serviceName) {
      throw new Error(
        `O projeto "${serviceName}" já existe em ${project.root}.`,
      );
    }
    if (project.root === projectRoot) {
      throw new Error(
        `O diretório "${projectRoot}" já pertence ao projeto "${name}".`,
      );
    }
  }
  if (tree.exists(projectRoot) && tree.children(projectRoot).length > 0) {
    throw new Error(`O diretório "${projectRoot}" já existe e não está vazio.`);
  }

  const tags = [
    'type:app',
    STACK_TAG[stack],
    'platform:serverless',
    ...(options.domain ? [`scope:${options.domain}`] : []),
    ...parseExtraTags(options.tags),
  ];

  return {
    serviceName,
    type,
    projectRoot,
    tags: [...new Set(tags)],
    templateModel: {
      serviceName,
      type,
      queue,
      queueParam: options.queueParam ?? `${serviceName}/queue`,
      typeDescription: TYPE_DESCRIPTION[type],
      projectRoot,
      offsetFromRoot: offsetFromRoot(projectRoot),
      memorySize: options.memorySize ?? 256,
      timeout: options.timeout ?? 29,
      ssmPrefix: SSM_PREFIX,
      tmpl: '',
    },
  };
}

export function addServiceProject(
  tree: Tree,
  service: NormalizedService,
  sourceRoot?: string,
): void {
  addProjectConfiguration(tree, service.serviceName, {
    root: service.projectRoot,
    projectType: 'application',
    ...(sourceRoot ? { sourceRoot } : {}),
    tags: service.tags,
  });
}

export function addRootDevDependencies(
  tree: Tree,
  options: BaseServiceSchema,
  devDependencies: Record<string, string>,
): GeneratorCallback | undefined {
  if (options.skipPackageJson) {
    return undefined;
  }
  return addDependenciesToPackageJson(tree, {}, devDependencies);
}
