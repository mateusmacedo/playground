import type { ServerlessOperation, Stack } from '../../shared/types.js';

export interface ValidateExecutorSchema {
  stack: Stack;
  operation?: ServerlessOperation;
  stage?: string;
  configPath?: string;
}
