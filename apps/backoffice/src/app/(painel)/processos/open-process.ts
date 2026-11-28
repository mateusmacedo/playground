import {
  findDefinition,
  type ProcessCatalog,
  type ProcessDefinition,
} from '@/shared/process/catalog';

import { BROWSER_PLACE } from './storage-place';

/** Processos que o seletor oferece: os não arquivados, na ordem do catálogo. */
export function liveDefinitions(
  catalog: ProcessCatalog,
): readonly ProcessDefinition[] {
  return catalog.definitions.filter((definition) => !definition.archived);
}

export interface AddressRequestParams {
  readonly catalog: ProcessCatalog;
  /** Id pedido no endereço da página; `null` quando o endereço não pede nenhum. */
  readonly requestedId: string | null;
  /** Onde os processos ficam guardados, para o aviso ("neste navegador", "no servidor"). */
  readonly place?: string;
}

export interface AddressRequest {
  /** Id do processo pedido, quando ele pode ser aberto. */
  readonly definitionId?: string;
  /** Aviso para a tela, quando o pedido não pode ser atendido. */
  readonly notice?: string;
}

/** O que fazer com o processo pedido no endereço: abrir, ou avisar que ele não existe ou está arquivado. */
export function resolveAddressRequest(
  params: AddressRequestParams,
): AddressRequest {
  const { catalog, requestedId, place = BROWSER_PLACE } = params;
  if (requestedId === null) {
    return {};
  }
  const definition = findDefinition({ catalog, definitionId: requestedId });
  if (definition === undefined) {
    return {
      notice: `O processo pedido no endereço não existe ${place}. Outro processo foi aberto no lugar.`,
    };
  }
  if (definition.archived) {
    return {
      notice: `O processo ${definition.name} está arquivado. Restaure-o em "Arquivados" para abrir.`,
    };
  }
  return { definitionId: definition.id };
}

export interface OpenDefinitionParams {
  readonly live: readonly ProcessDefinition[];
  /** Ids candidatos, do mais prioritário para o menos; os que não são de processo ativo são ignorados. */
  readonly candidates: readonly (string | null | undefined)[];
}

/** Processo aberto: o primeiro candidato que é de um processo não arquivado ou, sem nenhum, o primeiro da lista. */
export function openDefinition(
  params: OpenDefinitionParams,
): ProcessDefinition | undefined {
  const { live, candidates } = params;
  for (const candidate of candidates) {
    const found = live.find((definition) => definition.id === candidate);
    if (found !== undefined) {
      return found;
    }
  }
  return live[0];
}

export interface NeighborParams {
  readonly live: readonly ProcessDefinition[];
  readonly definitionId: string;
}

/** Processo que passa a ser o aberto quando `definitionId` sai da lista: o seguinte ou, no fim da lista, o anterior. */
export function neighborDefinition(
  params: NeighborParams,
): ProcessDefinition | undefined {
  const { live, definitionId } = params;
  const index = live.findIndex((definition) => definition.id === definitionId);
  if (index < 0) {
    return undefined;
  }
  return live[index + 1] ?? live[index - 1];
}
