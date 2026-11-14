import baseConfig from '../../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    ignores: ['.serverless/**', 'out-tsc/**'],
  },
];
