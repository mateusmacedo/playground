import { posix } from 'node:path';

import type { TargetConfiguration } from '@nx/devkit';

import { pickDefaultConfiguration } from '../../core/stage-configurations.js';
import {
  commonServerlessTargets,
  createTargetFactory,
  DEPLOY_CONFIGURATIONS,
} from '../../core/target-builders.js';
import type { ServerlessManifest, TargetContext } from '../../core/types.js';
import { AWS_TO_GO_ARCH } from '../../shared/constants.js';
import type { AwsArch, GoArch } from '../../shared/types.js';
import { resolveGoPackage } from './go-package.js';

const GO_SOURCE_INPUTS = [
  '{projectRoot}/**/*.go',
  '{projectRoot}/go.mod',
  '{projectRoot}/go.sum',
  { runtime: 'go version' },
];

// WHY: o script é o mesmo do ci.yml e do release.yml, para o lint local e o CI
// não divergirem; ele é input do lint porque mudá-lo muda o resultado.
const GO_FMT_CHECK_SCRIPT = 'tools/go-fmt-check.sh';

// NOTE: o lint roda com cwd na pasta do projeto, e o Nx troca `{workspaceRoot}`
// em um comando por um caminho relativo à raiz do workspace, que não resolve
// daí: o caminho do script é calculado a partir do projeto.
function goLintCommand(projectRoot: string): string {
  const script = posix.relative(projectRoot, GO_FMT_CHECK_SCRIPT);
  return `bash ${script} && go vet ./...`;
}

const AWS_ARCH_LITERAL = /\b(arm64|x86_64)\b/g;

// WHY: `provider.architecture` costuma ser `${env:SLS_ARCH, 'arm64'}`; o
// literal final é o padrão de produção e define a arquitetura do build sem
// configuration, mantendo binário e manifesto alinhados.
export function architectureFromManifest(
  architecture: string | undefined,
): GoArch | undefined {
  const literals = architecture?.match(AWS_ARCH_LITERAL);
  const last = literals?.at(-1) as AwsArch | undefined;
  return last ? AWS_TO_GO_ARCH[last] : undefined;
}

export function resolveGoTargets(
  ctx: TargetContext,
  manifest: Pick<ServerlessManifest, 'architecture' | 'goPackage'>,
  absProjectRoot: string,
): Record<string, TargetConfiguration> {
  const factory = createTargetFactory(ctx, 'go');
  const { buildTargetName, testTargetName, lintTargetName } = ctx.options;
  const architecture =
    architectureFromManifest(manifest.architecture) ??
    ctx.options.defaultGoArchitecture;
  const packagePath = resolveGoPackage(absProjectRoot, manifest.goPackage);
  const defaultConfiguration = pickDefaultConfiguration(
    DEPLOY_CONFIGURATIONS,
    ctx.options.defaultConfiguration,
  );

  // WHY: o Nx só repassa às dependências a configuration pedida na linha de
  // comando; sem `-c`, cada target usa a própria defaultConfiguration. O build
  // precisa da mesma do deploy para o binário casar com o SLS_ARCH.
  const buildConfigurations = Object.fromEntries(
    DEPLOY_CONFIGURATIONS.map((name) => [
      name,
      { architecture: name === 'floci' ? ctx.hostGoArch : architecture },
    ]),
  );

  return {
    [testTargetName]: factory.withMetadata(
      {
        command: 'go test -race -cover ./...',
        options: { cwd: ctx.projectRoot },
        cache: true,
        inputs: GO_SOURCE_INPUTS,
      },
      'Executa os testes Go',
    ),
    [lintTargetName]: factory.withMetadata(
      {
        command: goLintCommand(ctx.projectRoot),
        options: { cwd: ctx.projectRoot },
        cache: true,
        inputs: [...GO_SOURCE_INPUTS, `{workspaceRoot}/${GO_FMT_CHECK_SCRIPT}`],
      },
      'Confere o gofmt e roda o go vet',
    ),
    [buildTargetName]: factory.withMetadata(
      {
        executor: `${ctx.executorPrefix}:go-build`,
        options: { architecture, ...(packagePath ? { packagePath } : {}) },
        configurations: buildConfigurations,
        ...(defaultConfiguration ? { defaultConfiguration } : {}),
        cache: true,
        inputs: [
          '{projectRoot}/**/*.go',
          '!{projectRoot}/**/*_test.go',
          '{projectRoot}/go.mod',
          '{projectRoot}/go.sum',
          { runtime: 'go version' },
          ...factory.pluginInputs,
        ],
        outputs: ['{projectRoot}/.bin'],
      },
      'Compila o binário da Lambda e gera .bin/bootstrap.zip',
    ),
    ...commonServerlessTargets(
      factory,
      ctx,
      [buildTargetName],
      [buildTargetName],
    ),
  };
}
