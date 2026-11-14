import type { GoArch } from '../../shared/types.js';

export interface GoBuildExecutorSchema {
  architecture?: GoArch;
  trimpath?: boolean;
  ldflags?: string;
  tags?: string;
  packagePath?: string;
}
