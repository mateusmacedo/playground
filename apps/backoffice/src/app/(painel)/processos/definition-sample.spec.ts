import { readFileSync } from 'node:fs';

import type { ProcessDefinitionDocument } from '@/shared/api/contract';
import { contractProjectFile } from '@/shared/process/contract-project-file';
import { readDefinition } from '@/shared/process/definition-documents';
import {
  SAMPLE_DRAFT_TEXT,
  SAMPLE_PUBLISHED_TEXT,
  samplePlan,
} from '@/shared/process/definition-sample-data';

import type { ProcessDocument } from './model/document';
import { parseDocument, serializeDocument } from './model/draft';
import { compilePlan } from './model/plan-compile';
import { documentErrorCount } from './publication';

/** O valor como ele viaja: sem os campos ausentes. */
function throughJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** O desenho como o editor o abre; falha quando ele não lê o texto ou precisa ajustar algum valor. */
function opened(text: string): ProcessDocument {
  const reading = parseDocument(text);
  if (reading === null || reading.adjusted > 0) {
    throw new Error('O editor não leu o desenho como ele foi gravado.');
  }
  return reading.document;
}

describe('desenho da amostra de definição de processo', () => {
  it.each([
    ['publicado', SAMPLE_PUBLISHED_TEXT],
    ['em rascunho', SAMPLE_DRAFT_TEXT],
  ])(
    'o %s é lido pelo editor sem ajuste e volta ao mesmo texto ao salvar',
    (_which, text) => {
      expect(serializeDocument(opened(text))).toBe(text);
    },
  );

  it('não tem erro que impeça a publicação', () => {
    expect(documentErrorCount(opened(SAMPLE_PUBLISHED_TEXT))).toBe(0);
  });

  it('compila no roteiro publicado da amostra', () => {
    const plan = compilePlan(opened(SAMPLE_PUBLISHED_TEXT));

    expect(throughJson(plan)).toEqual(samplePlan);
  });
});

describe('desenhos dos dados iniciais do mock', () => {
  const seed = JSON.parse(
    readFileSync(contractProjectFile('seed/process-definitions.json'), 'utf8'),
  ) as readonly ProcessDefinitionDocument[];

  it.each(seed)('o editor lê o rascunho de $id sem ajuste', (document) => {
    const draftText = readDefinition(document)?.draftText ?? '';

    expect(serializeDocument(opened(draftText))).toBe(draftText);
  });

  it.each(seed)(
    'o roteiro publicado de $id é o compilado do desenho publicado',
    (document) => {
      const versions = readDefinition(document)?.versions ?? [];

      expect(versions.length).toBeGreaterThan(0);
      for (const version of versions) {
        const plan = compilePlan(opened(version.documentText));
        expect(throughJson(plan)).toEqual(throughJson(version.plan));
      }
    },
  );
});
