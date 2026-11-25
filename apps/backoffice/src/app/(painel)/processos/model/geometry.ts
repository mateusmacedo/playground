/** Tamanho aproximado de um bloco, para centralizar, alinhar e organizar sem medir a tela. */
export const BLOCK_SIZE = { width: 180, height: 64 } as const;

/** Passo da grade do canvas; posições organizadas caem nela. */
export const GRID_STEP = 16;

/** Valor arredondado para o ponto mais próximo da grade. */
export function snapToGrid(value: number): number {
  return Math.round(value / GRID_STEP) * GRID_STEP;
}
