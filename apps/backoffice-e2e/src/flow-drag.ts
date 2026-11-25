import type { Locator, Page } from '@playwright/test';

/** Movimentos do mouse entre o ponto de saída e o de chegada de uma ligação. */
const DRAG_STEPS = 10;

interface Point {
  readonly x: number;
  readonly y: number;
}

async function centerOf(locator: Locator): Promise<Point> {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error('O ponto de ligação não está na tela.');
  }
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

interface DragParams {
  readonly page: Page;
  readonly from: Locator;
  readonly to: Point;
}

// WHY: o `dragTo` move o mouse num salto só; sob carga, o React Flow ainda não registrou a ligação em andamento quando o
// botão é solto e a ligação se perde. Andar em passos dá a ele os eventos de movimento que espera.
async function dragInSteps({ page, from, to }: DragParams) {
  const start = await centerOf(from);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: DRAG_STEPS });
  await page.mouse.up();
}

export interface DragBetweenParams {
  readonly page: Page;
  readonly from: Locator;
  readonly to: Locator;
}

/** Liga uma porta a outra arrastando o mouse em passos. */
export async function dragBetween({ page, from, to }: DragBetweenParams) {
  await dragInSteps({ page, from, to: await centerOf(to) });
}

export interface DragToAreaParams {
  readonly page: Page;
  readonly from: Locator;
  readonly area: Locator;
  /** Posição dentro da área, a partir do canto superior esquerdo. */
  readonly offset: Point;
}

/** Arrasta de uma porta até um ponto de uma área, como uma parte vazia do canvas. */
export async function dragToArea({
  page,
  from,
  area,
  offset,
}: DragToAreaParams) {
  const box = await area.boundingBox();
  if (!box) {
    throw new Error('A área de destino não está na tela.');
  }
  await dragInSteps({
    page,
    from,
    to: { x: box.x + offset.x, y: box.y + offset.y },
  });
}
