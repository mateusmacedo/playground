import type { ProcessDefinitionSeed } from './mock-documents';
import type { MockServer } from './mock-server';

/** O processo que o editor abre quando o endereço não pede outro. */
export const MAIN_PROCESS_ID = 'process-1';

export interface WithRenamedBlockParams {
  readonly seed: ProcessDefinitionSeed;
  readonly from: string;
  readonly to: string;
}

/**
 * O mesmo processo com um bloco do rascunho renomeado: é a mudança que "outra pessoa" grava num teste de conflito.
 */
export function withRenamedBlock({
  seed,
  from,
  to,
}: WithRenamedBlockParams): ProcessDefinitionSeed {
  const { definition } = seed;
  if (definition.draftText === null) {
    throw new Error(`O processo ${seed.id} não tem rascunho para alterar.`);
  }
  // NOTE: o rascunho é um texto JSON, e o título do bloco aparece nele como texto entre aspas.
  const draftText = definition.draftText.replaceAll(
    JSON.stringify(from),
    JSON.stringify(to),
  );
  return { ...seed, definition: { ...definition, draftText } };
}

export interface SavedDraftParams {
  readonly mock: MockServer;
  readonly definitionId?: string;
}

/**
 * O rascunho do processo como está gravado no mock, ou texto vazio quando não há. Use com `expect.poll` para esperar
 * o salvamento chegar ao servidor.
 */
export async function savedDraftText({
  mock,
  definitionId = MAIN_PROCESS_ID,
}: SavedDraftParams): Promise<string> {
  const stored = await mock.readDefinition(definitionId);
  return stored?.definition.draftText ?? '';
}
