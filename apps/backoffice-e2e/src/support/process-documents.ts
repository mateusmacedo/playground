import type { ProcessDefinitionSeed } from './mock-documents';
import { initialDefinition, sampleDefinition } from './mock-samples';

/** O processo dos dados iniciais do mock: Início, "Primeira etapa" (tarefa sem campo e sem papel) e Fim. */
export const EXAMPLE_PROCESS = 'Processo de exemplo';
/** O processo rico da amostra do contrato, semeado por `purchaseDefinition`. */
export const PURCHASE_PROCESS = 'Pedido de compra';
const PURCHASE_PROCESS_ID = 'process-purchase';

/**
 * O "Pedido de compra" da amostra do contrato, com id próprio para conviver com o processo dos dados iniciais: tarefa
 * humana com campos, aprovação, decisão, caminhos em paralelo, subprocesso e dois fins, publicado na versão 1.
 */
export function purchaseDefinition(): ProcessDefinitionSeed {
  const sample = sampleDefinition();
  return {
    ...sample,
    id: PURCHASE_PROCESS_ID,
    definition: { ...sample.definition, id: PURCHASE_PROCESS_ID },
  };
}

/** O processo dos dados iniciais sem nenhuma versão publicada: com ele no lugar, o catálogo não tem o que iniciar. */
export function unpublishedInitialDefinition(): ProcessDefinitionSeed {
  const initial = initialDefinition();
  return { ...initial, definition: { ...initial.definition, versions: [] } };
}
