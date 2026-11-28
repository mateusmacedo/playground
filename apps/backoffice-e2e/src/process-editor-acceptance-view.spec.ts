import { expect, type Page } from '@playwright/test';

import {
  LOOSE_STEP,
  LOOSE_STEP_DRAFT,
  mainProcessWith,
} from './support/editor-acceptance-drafts';
import {
  type FlowPoint,
  flowPosition,
  isInsideCanvas,
  viewportOf,
  viewportText,
  visibleCenter,
} from './support/flow-geometry';
import { test } from './support/mock-test';
import {
  canvas,
  edge,
  nodes,
  openEditor,
  properties,
  selectNode,
  toolbar,
} from './support/process-editor-screen';
import { saveDraft } from './support/process-workspace-screen';

test.use({ viewport: { width: 1600, height: 1000 } });

/** Metade do tamanho que o editor usa para centralizar um bloco novo, em pixels do canvas. */
const HALF_BLOCK = { width: 90, height: 32 } as const;
/** Deslocamento de cada inserção seguida pelo `+`, nos dois eixos. */
const CASCADE_STEP = 24;
/** Inserções seguidas antes de a cascata voltar ao centro. */
const CASCADE_LENGTH = 5;
// WHY: com a grade ligada, o React Flow arredonda o centro da tela para a grade de 16 px antes de o editor posicionar
// o bloco; o centro do bloco fica a no máximo meio passo da grade do centro calculado aqui.
const CENTER_TOLERANCE = 8;
/** Zoom em que o editor enquadra o bloco de um problema selecionado (o máximo do enquadramento). */
const FOCUS_ZOOM = 1.2;
const ZOOM_IN_CLICKS = 3;

function nodeWith(page: Page, text: string) {
  return nodes(page).filter({ hasText: text }).first();
}

async function positionsOf(
  page: Page,
  texts: readonly string[],
): Promise<FlowPoint[]> {
  const positions: FlowPoint[] = [];
  for (const text of texts) {
    positions.push(await flowPosition(nodeWith(page, text)));
  }
  return positions;
}

test.describe('editor de processos: aceite do enquadramento e da persistência', () => {
  test('muda o enquadramento ao selecionar um problema e ao ajustar à tela', async ({
    page,
    mock,
  }) => {
    await mock.seedDefinition(mainProcessWith(LOOSE_STEP_DRAFT));
    await openEditor(page);
    for (let click = 0; click < ZOOM_IN_CLICKS; click += 1) {
      await page.getByRole('button', { name: 'Aumentar o zoom' }).click();
    }
    const zoomed = await viewportText(page);
    await expect(nodeWith(page, LOOSE_STEP)).not.toBeInViewport();

    await properties(page)
      .getByRole('button', {
        name: `Erro: ${LOOSE_STEP} não tem conexão de entrada.`,
      })
      .click();

    await expect(
      properties(page).getByLabel('Título', { exact: true }),
    ).toHaveValue(LOOSE_STEP);
    await expect.poll(() => viewportText(page)).not.toBe(zoomed);
    // NOTE: o enquadramento do problema é animado; ele termina quando o zoom chega ao máximo do enquadramento.
    await expect
      .poll(async () => (await viewportOf(page)).zoom)
      .toBe(FOCUS_ZOOM);
    await expect
      .poll(() => isInsideCanvas(page, nodeWith(page, LOOSE_STEP)))
      .toBe(true);
    await expect
      .poll(() => isInsideCanvas(page, nodeWith(page, 'Início')))
      .toBe(false);
    const focused = await viewportText(page);

    await toolbar(page).getByRole('button', { name: 'Ajustar à tela' }).click();

    await expect.poll(() => viewportText(page)).not.toBe(focused);
    for (const text of ['Início', 'Primeira etapa', 'Fim', LOOSE_STEP]) {
      await expect
        .poll(() => isInsideCanvas(page, nodeWith(page, text)))
        .toBe(true);
    }
  });

  test('anuncia a nova posição ao mover o bloco pelo teclado', async ({
    page,
  }) => {
    await openEditor(page);
    const block = nodeWith(page, 'Primeira etapa');
    const before = await flowPosition(block);

    await block.focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('ArrowRight');

    const announcement = canvas(page).getByText(
      /^Bloco movido para a direita\. Nova posição: x -?\d+, y -?\d+\.$/,
    );
    await expect(announcement).toHaveCount(1);
    const after = await flowPosition(block);
    expect(after.x).toBeGreaterThan(before.x);
    await expect(announcement).toHaveText(
      `Bloco movido para a direita. Nova posição: x ${Math.round(after.x)}, y ${Math.round(after.y)}.`,
    );
  });

  test('insere pelo + em cascata: a 1ª no centro, passos de 24 px e a 6ª de volta ao centro', async ({
    page,
  }) => {
    await openEditor(page);
    const center = await visibleCenter(page);
    const insert = page.getByRole('button', { name: 'Inserir Etapa' });

    for (let count = 0; count <= CASCADE_LENGTH; count += 1) {
      await insert.click();
    }
    await expect(nodes(page)).toHaveCount(3 + CASCADE_LENGTH + 1);

    const inserted: FlowPoint[] = [];
    for (let index = 0; index <= CASCADE_LENGTH; index += 1) {
      inserted.push(await flowPosition(nodes(page).nth(3 + index)));
    }
    const [first] = inserted;
    if (first === undefined) {
      throw new Error('Nenhum bloco foi inserido.');
    }
    expect(Math.abs(first.x + HALF_BLOCK.width - center.x)).toBeLessThanOrEqual(
      CENTER_TOLERANCE,
    );
    expect(
      Math.abs(first.y + HALF_BLOCK.height - center.y),
    ).toBeLessThanOrEqual(CENTER_TOLERANCE);
    const offsets = inserted.map((point) => ({
      x: Math.round(point.x - first.x),
      y: Math.round(point.y - first.y),
    }));
    expect(offsets).toEqual([
      { x: 0, y: 0 },
      { x: CASCADE_STEP, y: CASCADE_STEP },
      { x: 2 * CASCADE_STEP, y: 2 * CASCADE_STEP },
      { x: 3 * CASCADE_STEP, y: 3 * CASCADE_STEP },
      { x: 4 * CASCADE_STEP, y: 4 * CASCADE_STEP },
      { x: 0, y: 0 },
    ]);
  });

  test('reabre o rascunho com as conexões, as posições e o responsável', async ({
    page,
  }) => {
    await openEditor(page);
    await page
      .getByLabel('Inserir bloco na conexão de Primeira etapa para Fim')
      .click();
    await page
      .getByRole('dialog', { name: 'Inserir bloco na conexão' })
      .getByRole('button', { name: /^Tarefa humana/ })
      .click();
    await properties(page).getByLabel('Título', { exact: true }).fill('Pagar');
    await properties(page).getByLabel('Papel responsável').fill('Financeiro');
    const blockTexts = ['Início', 'Primeira etapa', 'Pagar', 'Fim'];
    const saved = await positionsOf(page, blockTexts);

    await saveDraft(page);
    await page.reload();
    await openEditor(page, { address: page.url() });

    await expect(nodes(page)).toHaveCount(blockTexts.length);
    expect(await positionsOf(page, blockTexts)).toEqual(saved);
    await expect(
      edge(page, 'Conexão de Início para Primeira etapa'),
    ).toHaveCount(1);
    await expect(
      edge(page, 'Conexão de Primeira etapa para Pagar'),
    ).toHaveCount(1);
    await expect(edge(page, 'Conexão de Pagar para Fim')).toHaveCount(1);
    await expect(canvas(page).locator('.react-flow__edge')).toHaveCount(3);
    await selectNode(page, 'Pagar');
    await expect(properties(page).getByLabel('Papel responsável')).toHaveValue(
      'Financeiro',
    );
  });
});
