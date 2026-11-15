import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type { ServerlessManifest } from '../../core/types.js';
import { getObject, hasKey } from '../../core/yaml.js';
import {
  findCmdPackages,
  normalizeGoPackage,
} from '../../languages/go/go-package.js';
import {
  ALLOWED_STAGES,
  GO_RUNTIME,
  GRADLE_BUILD_FILES,
  JAVA_RUNTIMES,
  LAMBDA_ARTIFACT_PATH,
  NODE_RUNTIME_PREFIX,
  PROTECTED_STAGE,
} from '../../shared/constants.js';
import { isKebabCase } from '../../shared/normalize.js';
import type {
  ServerlessOperation,
  ServerlessStage,
  Stack,
} from '../../shared/types.js';

export type ValidationInput = {
  manifest: ServerlessManifest;
  stack: Stack;
  operation: ServerlessOperation;
  stage: string | undefined;
  absProjectRoot: string;
  projectRoot: string;
};

export type ValidationReport = {
  errors: string[];
  warnings: string[];
};

const STAGE_REQUIRED_OPERATIONS: ReadonlySet<ServerlessOperation> = new Set([
  'deploy',
  'package',
  'remove',
]);

const ARTIFACT_REQUIRED_OPERATIONS: ReadonlySet<ServerlessOperation> = new Set([
  'deploy',
  'package',
]);

const isAllowedStage = (stage: string): stage is ServerlessStage =>
  (ALLOWED_STAGES as readonly string[]).includes(stage);

function manifestRules(input: ValidationInput, errors: string[]): void {
  const { manifest, stack, projectRoot } = input;
  const parsed = manifest.parsed;

  if (hasKey(parsed, 'extends')) {
    errors.push(
      'O Serverless Framework v4 não aceita "extends"; declare provider, IAM e plugins no próprio serverless.yml.',
    );
  }

  if (!hasKey(getObject(parsed, 'custom'), 'nxServerless')) {
    errors.push('O manifesto precisa declarar "custom.nxServerless".');
  }

  if (manifest.language && manifest.language !== stack) {
    errors.push(
      `custom.nxServerless.language é "${manifest.language}", mas o target foi inferido para "${stack}".`,
    );
  }

  if (manifest.providerName !== 'aws') {
    errors.push(
      `provider.name deve ser "aws", recebido "${manifest.providerName ?? 'indefinido'}".`,
    );
  }

  if (!manifest.service) {
    errors.push(`Falta a chave "service" em ${projectRoot}/serverless.yml.`);
  } else if (!isKebabCase(manifest.service)) {
    errors.push(`O nome do serviço "${manifest.service}" deve ser kebab-case.`);
  }
}

function stageRules(input: ValidationInput, errors: string[]): void {
  const { operation } = input;
  const stage = input.stage?.trim().toLowerCase() || undefined;

  if (!stage) {
    if (STAGE_REQUIRED_OPERATIONS.has(operation)) {
      errors.push(`O stage é obrigatório para a operação "${operation}".`);
    }
    return;
  }

  if (operation === 'remove' && stage === PROTECTED_STAGE) {
    errors.push(
      `Remoção em "${PROTECTED_STAGE}" bloqueada pelo plugin; siga o runbook de descomissionamento.`,
    );
    return;
  }

  if (!isAllowedStage(stage)) {
    errors.push(
      `Stage "${stage}" não permitido. Stages válidos: ${ALLOWED_STAGES.join(', ')}.`,
    );
  }
}

const PARAM_REFERENCE = /^\$\{param:([A-Za-z0-9_-]+)\}$/;

// WHY: o runtime pode variar por stage via `params` (JVM no local, nativo na
// AWS); resolvemos só a forma `${param:<nome>}`, com fallback em `default`.
export function resolveRuntime(input: ValidationInput): string | undefined {
  const { manifest } = input;
  const match = manifest.runtime?.match(PARAM_REFERENCE);
  if (!match) {
    return manifest.runtime;
  }
  const stage = input.stage?.trim().toLowerCase();
  const name = match[1];
  const value =
    (stage ? manifest.params[stage]?.[name] : undefined) ??
    manifest.params.default?.[name];
  return typeof value === 'string' ? value : undefined;
}

function typescriptRules(input: ValidationInput, errors: string[]): void {
  const { absProjectRoot } = input;
  const runtime = resolveRuntime(input);

  if (!runtime?.startsWith(NODE_RUNTIME_PREFIX)) {
    errors.push(
      `O runtime TypeScript deve começar com "${NODE_RUNTIME_PREFIX}", recebido "${runtime ?? 'indefinido'}".`,
    );
  }

  for (const file of ['package.json', 'tsconfig.json']) {
    if (!existsSync(join(absProjectRoot, file))) {
      errors.push(`Falta ${file} na raiz do projeto.`);
    }
  }
}

function allFunctionsUseContainerImage(manifest: ServerlessManifest): boolean {
  const functions = getObject(manifest.parsed, 'functions');
  const definitions = functions ? Object.values(functions) : [];
  return (
    definitions.length > 0 &&
    definitions.every((definition) => hasKey(definition, 'image'))
  );
}

function hasGoEntrypoint(absProjectRoot: string): boolean {
  return (
    existsSync(join(absProjectRoot, 'main.go')) ||
    findCmdPackages(absProjectRoot).length > 0
  );
}

function goRules(
  input: ValidationInput,
  errors: string[],
  warnings: string[],
): void {
  const { manifest, absProjectRoot } = input;
  const runtime = resolveRuntime(input);

  if (runtime !== GO_RUNTIME) {
    errors.push(
      `O runtime Go deve ser "${GO_RUNTIME}", recebido "${runtime ?? 'indefinido'}".`,
    );
  }

  if (!existsSync(join(absProjectRoot, 'go.mod'))) {
    errors.push('Falta go.mod na raiz do projeto.');
  }

  if (manifest.goPackage) {
    const goPackage = normalizeGoPackage(manifest.goPackage);
    if (!existsSync(join(absProjectRoot, goPackage, 'main.go'))) {
      errors.push(
        `custom.nxServerless.goPackage aponta para "${goPackage}", mas ${goPackage}/main.go não existe.`,
      );
    }
  } else if (!hasGoEntrypoint(absProjectRoot)) {
    warnings.push('Nenhum main.go encontrado na raiz nem em cmd/*/.');
  }

  artifactRules(input, errors, warnings, LAMBDA_ARTIFACT_PATH);
}

function artifactsToVerify(
  manifest: ServerlessManifest,
  fallback: string | undefined,
): string[] {
  if (manifest.artifacts.length > 0) {
    return manifest.artifacts;
  }
  return fallback ? [fallback] : [];
}

function artifactRules(
  input: ValidationInput,
  errors: string[],
  warnings: string[],
  fallback?: string,
): void {
  const { manifest, absProjectRoot, operation } = input;
  // WHY: só dispensa o artefato quando todas as funções usam imagem de
  // container; um manifesto misto ainda precisa do zip.
  if (
    !ARTIFACT_REQUIRED_OPERATIONS.has(operation) ||
    allFunctionsUseContainerImage(manifest)
  ) {
    return;
  }

  const artifacts = artifactsToVerify(manifest, fallback);
  if (artifacts.length === 0) {
    errors.push(
      'Declare o artefato em package.artifact (do serviço ou da função).',
    );
    return;
  }

  for (const artifact of artifacts) {
    if (artifact.includes('${')) {
      warnings.push(
        `O artefato "${artifact}" usa variável; a existência não foi verificada.`,
      );
    } else if (!existsSync(join(absProjectRoot, artifact))) {
      errors.push(
        `Artefato ${artifact} não encontrado; rode o target de build antes de "${operation}".`,
      );
    }
  }
}

function javaRules(
  input: ValidationInput,
  errors: string[],
  warnings: string[],
): void {
  const runtime = resolveRuntime(input);
  if (!runtime || !JAVA_RUNTIMES.includes(runtime)) {
    errors.push(
      `O runtime Java deve ser um de ${JAVA_RUNTIMES.join(', ')}, recebido "${runtime ?? input.manifest.runtime ?? 'indefinido'}".`,
    );
  }

  if (
    !GRADLE_BUILD_FILES.some((file) =>
      existsSync(join(input.absProjectRoot, file)),
    )
  ) {
    errors.push('Falta build.gradle.kts (ou build.gradle) na raiz do projeto.');
  }

  artifactRules(input, errors, warnings);
}

export function validateServerlessProject(
  input: ValidationInput,
): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (input.manifest.parsed === null) {
    return { errors: ['O serverless.yml não é um YAML válido.'], warnings };
  }

  manifestRules(input, errors);
  stageRules(input, errors);

  if (input.stack === 'typescript') {
    typescriptRules(input, errors);
  } else if (input.stack === 'go') {
    goRules(input, errors, warnings);
  } else {
    javaRules(input, errors, warnings);
  }

  return { errors, warnings };
}
