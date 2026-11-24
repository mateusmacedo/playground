import type { BoardLane } from './board';

export interface NextIdParams {
  readonly prefix: string;
  readonly taken: Iterable<string>;
}

/**
 * Próximo id no formato `<prefixo>-<número>`, acima do maior número em uso com o mesmo prefixo.
 *
 * WHY: o `crypto.randomUUID` só existe em contexto seguro, e o painel também é aberto por HTTP pela rede local.
 */
export function nextId(params: NextIdParams): string {
  const { prefix, taken } = params;
  let highest = 0;
  for (const id of taken) {
    const suffix = id.startsWith(`${prefix}-`)
      ? id.slice(prefix.length + 1)
      : '';
    if (/^\d+$/.test(suffix)) {
      highest = Math.max(highest, Number(suffix));
    }
  }
  return `${prefix}-${highest + 1}`;
}

export function nextLaneId(lanes: readonly BoardLane[]): string {
  return nextId({ prefix: 'lane', taken: lanes.map((lane) => lane.id) });
}

export function nextCardId(lanes: readonly BoardLane[]): string {
  return nextId({
    prefix: 'card',
    taken: lanes.flatMap((lane) => lane.cards.map((card) => card.id)),
  });
}
