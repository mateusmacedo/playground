import type { Locator, Page } from '@playwright/test';

import { canvas } from './process-editor-screen';

export interface FlowPoint {
  readonly x: number;
  readonly y: number;
}

/** Posição e zoom do canvas: o deslocamento em pixels da tela e a escala. */
export interface Viewport extends FlowPoint {
  readonly zoom: number;
}

const TRANSLATE = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/;
const SCALE = /scale\((-?[\d.]+)\)/;

async function transformOf(locator: Locator): Promise<string> {
  const style = (await locator.getAttribute('style')) ?? '';
  const match = /transform:\s*([^;]+)/.exec(style);
  if (match === null) {
    throw new Error(`O elemento não tem transformação no estilo: "${style}".`);
  }
  return match[1] ?? '';
}

function translateIn(transform: string): FlowPoint {
  const match = TRANSLATE.exec(transform);
  if (match === null) {
    throw new Error(`A transformação não tem deslocamento: "${transform}".`);
  }
  return { x: Number(match[1]), y: Number(match[2]) };
}

// NOTE: o React Flow guarda a posição e o zoom no `transform` do elemento do viewport e a posição de cada bloco, em
// coordenadas do canvas, no `transform` do bloco; são os números que o editor grava, independentes do zoom da tela.
function viewportElement(page: Page): Locator {
  return canvas(page).locator('.react-flow__viewport');
}

/** O deslocamento e o zoom atuais do canvas. */
export async function viewportOf(page: Page): Promise<Viewport> {
  const transform = await transformOf(viewportElement(page));
  const scale = SCALE.exec(transform);
  return { ...translateIn(transform), zoom: Number(scale?.[1] ?? 1) };
}

/** O texto do `transform` do viewport, para conferir que ele mudou. */
export async function viewportText(page: Page): Promise<string> {
  return transformOf(viewportElement(page));
}

/** A posição do bloco em coordenadas do canvas (o canto de cima à esquerda). */
export async function flowPosition(node: Locator): Promise<FlowPoint> {
  return translateIn(await transformOf(node));
}

/** O ponto do canvas que está no centro da área visível. */
export async function visibleCenter(page: Page): Promise<FlowPoint> {
  const box = await canvas(page).boundingBox();
  if (box === null) {
    throw new Error('O canvas não está na tela.');
  }
  const viewport = await viewportOf(page);
  return {
    x: (box.width / 2 - viewport.x) / viewport.zoom,
    y: (box.height / 2 - viewport.y) / viewport.zoom,
  };
}

/** O que o teste usa de um `<path>` do SVG; o tsconfig do e2e não carrega os tipos do DOM. */
interface SvgPathLike {
  getTotalLength(): number;
  getPointAtLength(distance: number): { x: number; y: number };
  getScreenCTM(): {
    a: number;
    b: number;
    c: number;
    d: number;
    e: number;
    f: number;
  } | null;
}

/** Fração do traçado onde a conexão é clicada: longe do meio, onde fica o botão de inserir bloco. */
const EDGE_CLICK_AT = 0.2;

export interface ClickEdgeParams {
  readonly page: Page;
  readonly edge: Locator;
  /** Acrescenta a conexão à seleção, com Ctrl ou Cmd. */
  readonly addToSelection?: boolean;
}

// WHY: o centro da caixa de uma conexão em degraus cai fora do traçado ou sobre o botão "+" do meio dela; o clique vai
// num ponto do próprio traçado, perto da origem.
export async function clickEdge({
  page,
  edge,
  addToSelection = false,
}: ClickEdgeParams) {
  const point = await edge
    .locator('path')
    .first()
    .evaluate((path: SvgPathLike, at: number) => {
      const local = path.getPointAtLength(path.getTotalLength() * at);
      const matrix = path.getScreenCTM();
      if (matrix === null) {
        return null;
      }
      return {
        x: matrix.a * local.x + matrix.c * local.y + matrix.e,
        y: matrix.b * local.x + matrix.d * local.y + matrix.f,
      };
    }, EDGE_CLICK_AT);
  if (point === null) {
    throw new Error('A conexão não está desenhada na tela.');
  }
  const modifier = 'ControlOrMeta';
  if (addToSelection) {
    await page.keyboard.down(modifier);
  }
  await page.mouse.click(point.x, point.y);
  if (addToSelection) {
    await page.keyboard.up(modifier);
  }
}

/** Se o retângulo do elemento cabe inteiro dentro da área visível do canvas. */
export async function isInsideCanvas(
  page: Page,
  element: Locator,
): Promise<boolean> {
  const area = await canvas(page).boundingBox();
  const box = await element.boundingBox();
  if (area === null || box === null) {
    return false;
  }
  return (
    box.x >= area.x &&
    box.y >= area.y &&
    box.x + box.width <= area.x + area.width &&
    box.y + box.height <= area.y + area.height
  );
}
