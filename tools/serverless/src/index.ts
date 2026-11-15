import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

import {
  type CreateNodes,
  type CreateNodesResult,
  createNodesFromFiles,
  hashArray,
} from '@nx/devkit';
import {
  calculateHashesForCreateNodes,
  hashObject,
  PluginCache,
  workspaceDataDirectory,
} from '@nx/devkit/internal';

import { normalizeOptions } from './core/plugin-options.js';
import { resolveServerlessTargets } from './core/resolve-serverless-targets.js';
import {
  detectServerlessBin,
  resolveServerlessCommand,
} from './core/serverless-cli.js';
import { detectHostGoArch } from './core/stage-configurations.js';
import type {
  NxServerlessPluginOptions,
  ResolvedTargets,
} from './core/types.js';
import { PLUGIN_PACKAGE_NAME } from './shared/constants.js';

export type { NxServerlessPluginOptions } from './core/types.js';

const serverlessConfigGlob = '**/serverless.yml';
const pluginRoot = join(import.meta.dirname, '..');

const PLUGIN_SOURCE = /\.(ts|json)$/;
const PLUGIN_SPEC = /\.spec\.ts$/;

let cachedSourceHash: string | undefined;

// WHY: ordem por code unit, igual em qualquer máquina, para o hash do plugin
// não mudar com o idioma do sistema, como mudaria com o `localeCompare`.
// Devolve -1, 0 ou 1 como o contrato do `sort` pede.
function compareByCodeUnit(left: string, right: string): number {
  return Number(left > right) - Number(left < right);
}

// WHY: o cache de inferência é chaveado pelos arquivos do serviço e pelas
// opções; sem o hash do próprio plugin, mudar um comando ou uma flag aqui só
// valeria depois de alguém mexer no serviço.
export function pluginSourceHash(root: string = pluginRoot): string {
  if (root === pluginRoot && cachedSourceHash) {
    return cachedSourceHash;
  }
  const files = readdirSync(join(root, 'src'), { recursive: true })
    .map(String)
    .filter((file) => PLUGIN_SOURCE.test(file) && !PLUGIN_SPEC.test(file))
    .sort(compareByCodeUnit);
  const hash = hashArray(
    files.flatMap((file) => [
      file,
      readFileSync(join(root, 'src', file), 'utf-8'),
    ]),
  );
  if (root === pluginRoot) {
    cachedSourceHash = hash;
  }
  return hash;
}

type PluginLocation = {
  executorPrefix: string;
  pluginSourceInput: string | undefined;
};

// WHY: `tools/` fica fora do workspace pnpm, então o Nx só encontra os
// executors pelo caminho relativo; instalado como pacote, vale o nome.
export function resolvePluginLocation(
  workspaceRoot: string,
  root: string = pluginRoot,
): PluginLocation {
  const rel = relative(workspaceRoot, root).split(sep).join('/');
  const isLocal =
    rel !== '' &&
    !rel.startsWith('..') &&
    !rel.split('/').includes('node_modules');

  return isLocal
    ? {
        executorPrefix: `./${rel}`,
        pluginSourceInput: `{workspaceRoot}/${rel}/src/**/*`,
      }
    : { executorPrefix: PLUGIN_PACKAGE_NAME, pluginSourceInput: undefined };
}

export const createNodes: CreateNodes<NxServerlessPluginOptions> = [
  serverlessConfigGlob,
  async (configFilePaths, rawOptions, context) => {
    const options = normalizeOptions(rawOptions);
    const hostGoArch = detectHostGoArch();
    const location = resolvePluginLocation(context.workspaceRoot);
    const serverlessBin = detectServerlessBin(context.workspaceRoot);
    const hashInputs = {
      ...options,
      ...location,
      hostGoArch,
      serverlessBin,
      pluginSourceHash: pluginSourceHash(),
    };

    const targetsCache = new PluginCache<ResolvedTargets>(
      join(workspaceDataDirectory, `serverless-${hashObject(hashInputs)}.hash`),
    );
    const hashes = await calculateHashesForCreateNodes(
      configFilePaths.map((configFile) => dirname(configFile)),
      hashInputs,
      context,
    );

    try {
      return await createNodesFromFiles(
        (configFile, _options, ctx, index): CreateNodesResult => {
          const projectRoot = dirname(configFile);
          const hash = `${hashes[index]}${configFile}`;

          let resolved = targetsCache.get(hash);
          if (!resolved) {
            resolved = resolveServerlessTargets(ctx.workspaceRoot, configFile, {
              projectRoot,
              options,
              hostGoArch,
              serverlessCommand: resolveServerlessCommand(
                projectRoot,
                serverlessBin,
                options.serverlessCommand,
              ),
              ...location,
            });
            targetsCache.set(hash, resolved);
          }

          return {
            projects: {
              [projectRoot]: {
                root: projectRoot,
                targets: resolved.targets,
                metadata: resolved.metadata,
              },
            },
          };
        },
        configFilePaths,
        rawOptions,
        context,
      );
    } finally {
      targetsCache.writeToDisk();
    }
  },
];

export const createNodesV2 = createNodes;
