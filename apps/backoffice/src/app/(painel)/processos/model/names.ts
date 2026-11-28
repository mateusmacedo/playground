/** Nome comparável: sem espaços nas pontas e sem diferença de maiúsculas, que é como a validação acha nome repetido. */
export function nameKey(name: string): string {
  return name.trim().toLocaleLowerCase('pt-BR');
}

export interface SuggestedNameParams {
  /** Palavra que vem antes do número, como "Caminho" ou "Campo". */
  readonly prefix: string;
  /** Nomes que os itens da lista já têm. */
  readonly taken: readonly string[];
}

/**
 * Nome provisório de um item novo: o primeiro "<prefixo> N" livre, contando a partir da quantidade de itens mais um.
 * Sem olhar os nomes em uso, o número repetiria depois de uma remoção, e o item novo já nasceria com nome repetido.
 */
export function suggestedName(params: SuggestedNameParams): string {
  const { prefix, taken } = params;
  const keys = new Set(taken.map(nameKey));
  let position = taken.length + 1;
  while (keys.has(nameKey(`${prefix} ${position}`))) {
    position += 1;
  }
  return `${prefix} ${position}`;
}
