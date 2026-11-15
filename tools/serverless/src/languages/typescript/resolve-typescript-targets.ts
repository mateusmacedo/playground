import type { TargetConfiguration } from '@nx/devkit';

import {
  commonServerlessTargets,
  createTargetFactory,
} from '../../core/target-builders.js';
import type { TargetContext } from '../../core/types.js';

// WHY: type-check, lint e testes do TypeScript já são inferidos pelos plugins
// @nx/js, @nx/eslint e @nx/vitest; aqui ficam só os targets do Serverless.
export function resolveTypescriptTargets(
  ctx: TargetContext,
): Record<string, TargetConfiguration> {
  const factory = createTargetFactory(ctx, 'typescript');
  return commonServerlessTargets(factory, ctx, [], []);
}
