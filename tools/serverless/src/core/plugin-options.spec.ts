import { describe, expect, it } from 'vitest';

import { defaultOptions, normalizeOptions } from './plugin-options.js';

describe('normalizeOptions', () => {
  it('usa os padrões quando o nx.json não informa opções', () => {
    expect(normalizeOptions(undefined)).toEqual(defaultOptions);
  });

  it('deixa as opções informadas vencerem os padrões e mantém o resto', () => {
    const options = normalizeOptions({
      deployTargetName: 'ship',
      defaultConfiguration: 'dev',
      serverlessCommand: 'pnpm exec serverless',
    });

    expect(options).toMatchObject({
      deployTargetName: 'ship',
      defaultConfiguration: 'dev',
      serverlessCommand: 'pnpm exec serverless',
      packageTargetName: defaultOptions.packageTargetName,
      flociEndpoint: defaultOptions.flociEndpoint,
    });
  });
});
