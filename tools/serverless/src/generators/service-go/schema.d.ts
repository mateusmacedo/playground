import type { GoArch } from '../../shared/types.js';
import type { BaseServiceSchema } from '../shared/service-project.js';

export interface ServiceGoGeneratorSchema extends BaseServiceSchema {
  goVersion?: string;
  architecture?: GoArch;
  modulePath?: string;
  skipGoModTidy?: boolean;
}
