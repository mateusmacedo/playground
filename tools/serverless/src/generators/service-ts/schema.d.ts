import type { BaseServiceSchema } from '../shared/service-project.js';

export interface ServiceTsGeneratorSchema extends BaseServiceSchema {
  runtime?: string;
}
