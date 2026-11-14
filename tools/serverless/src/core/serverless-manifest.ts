import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ServerlessManifest } from './types.js';
import {
  getObject,
  getString,
  isPlainObject,
  parseYamlObject,
} from './yaml.js';

export function parseServerlessManifest(raw: string): ServerlessManifest {
  const parsed = parseYamlObject(raw);
  const provider = getObject(parsed, 'provider');
  const nxServerless = getObject(getObject(parsed, 'custom'), 'nxServerless');

  return {
    parsed,
    service: getString(parsed, 'service'),
    providerName: getString(provider, 'name'),
    runtime: getString(provider, 'runtime'),
    architecture: getString(provider, 'architecture'),
    language: getString(nxServerless, 'language')?.toLowerCase(),
    goPackage: getString(nxServerless, 'goPackage'),
    gradleProject: getString(nxServerless, 'gradleProject'),
    artifacts: declaredArtifacts(parsed),
    params: stageParams(parsed),
  };
}

export function readServerlessManifest(
  workspaceRoot: string,
  configFilePath: string,
): ServerlessManifest {
  return parseServerlessManifest(
    readFileSync(join(workspaceRoot, configFilePath), 'utf-8'),
  );
}

function declaredArtifacts(parsed: Record<string, unknown> | null): string[] {
  const artifacts: string[] = [];
  const serviceArtifact = getString(getObject(parsed, 'package'), 'artifact');
  if (serviceArtifact) {
    artifacts.push(serviceArtifact);
  }
  for (const definition of Object.values(
    getObject(parsed, 'functions') ?? {},
  )) {
    const artifact = getString(getObject(definition, 'package'), 'artifact');
    if (artifact) {
      artifacts.push(artifact);
    }
  }
  return [...new Set(artifacts)];
}

function stageParams(
  parsed: Record<string, unknown> | null,
): Record<string, Record<string, unknown>> {
  const params = getObject(parsed, 'params') ?? {};
  return Object.fromEntries(
    Object.entries(params).filter(
      (entry): entry is [string, Record<string, unknown>] =>
        isPlainObject(entry[1]),
    ),
  );
}
