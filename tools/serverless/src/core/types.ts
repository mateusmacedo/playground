import type { TargetConfiguration } from '@nx/devkit';

import type { GoArch, Stack, StageConfigurationName } from '../shared/types.js';

export type NxServerlessPluginOptions = {
  validateTargetName?: string;
  packageTargetName?: string;
  deployTargetName?: string;
  removeTargetName?: string;
  invokeLocalTargetName?: string;
  buildTargetName?: string;
  testTargetName?: string;
  lintTargetName?: string;
  defaultConfiguration?: StageConfigurationName;
  defaultGoArchitecture?: GoArch;
  serverlessCommand?: string;
  gradleCommand?: string;
  flociEndpoint?: string;
  flociRegion?: string;
};

export type NormalizedPluginOptions = Required<
  Omit<NxServerlessPluginOptions, 'serverlessCommand'>
> &
  Pick<NxServerlessPluginOptions, 'serverlessCommand'>;

export type TargetContext = {
  projectRoot: string;
  options: NormalizedPluginOptions;
  executorPrefix: string;
  pluginSourceInput: string | undefined;
  hostGoArch: GoArch;
  serverlessCommand: string;
};

export type ResolvedTargets = {
  targets: Record<string, TargetConfiguration>;
  metadata: Record<string, unknown>;
};

export type ServerlessManifest = {
  parsed: Record<string, unknown> | null;
  service: string | undefined;
  providerName: string | undefined;
  runtime: string | undefined;
  architecture: string | undefined;
  language: string | undefined;
  goPackage: string | undefined;
  gradleProject: string | undefined;
  artifacts: string[];
  params: Record<string, Record<string, unknown>>;
};

export type DetectionResult = {
  language: Stack;
  source: 'filesystem' | 'manifest';
};
