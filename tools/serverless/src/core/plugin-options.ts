import type {
  NormalizedPluginOptions,
  NxServerlessPluginOptions,
} from './types.js';

export const defaultOptions: NormalizedPluginOptions = {
  validateTargetName: 'pre-deploy',
  packageTargetName: 'package',
  deployTargetName: 'deploy',
  removeTargetName: 'remove',
  invokeLocalTargetName: 'invoke-local',
  buildTargetName: 'build',
  testTargetName: 'test',
  lintTargetName: 'lint',
  defaultConfiguration: 'floci',
  defaultGoArchitecture: 'arm64',
  gradleCommand: './gradlew',
  flociEndpoint: 'http://localhost:4566',
  flociRegion: 'us-east-1',
};

export function normalizeOptions(
  options: NxServerlessPluginOptions | undefined,
): NormalizedPluginOptions {
  return { ...defaultOptions, ...options };
}
