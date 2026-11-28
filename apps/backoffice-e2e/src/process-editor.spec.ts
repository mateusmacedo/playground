import { expect, type Page } from '@playwright/test';

import { dragBetween } from './flow-drag';
import { test } from './support/mock-test';
import {
  canvas,
  issueStatus,
  nodes,
  openEditor,
  port,
  toolbar,
} from './support/process-editor-screen';
import { openByMenu } from './support/side-menu';
import { openThemeMenu } from './theme-menu';

// WHY: com a largura padrão o canvas fica estreito, e o bloco solto cairia em cima dos blocos do exemplo.
test.use({ viewport: { width: 1600, height: 1000 } });

/** Cor de fundo do cartão da página, que usa a mesma variável do tema (`--cui-body-bg`) que o canvas. */
async function cardBackground(page: Page): Promise<string> {
  // WHY: o tsconfig do e2e não carrega os tipos do DOM; a expressão em texto roda no navegador sem precisar deles.
  return page.evaluate<string>(
    "getComputedStyle(document.querySelector('.process-editor').closest('.card')).backgroundColor",
  );
}

/** Solta um bloco da biblioteca numa área vazia do canvas, à direita do exemplo. */
async function dropBlock(page: Page, label: string) {
  const item = page
    .getByRole('region', { name: 'Blocos' })
    .getByRole('listitem')
    .filter({ hasText: new RegExp(`^${label}`) });
  await item.dragTo(canvas(page), { targetPosition: { x: 640, y: 140 } });
}

test.describe('editor de processos', () => {
  test('abre pelo menu lateral com biblioteca, canvas e propriedades', async ({
    page,
  }) => {
    await page.goto('/');
    await openByMenu({ page, group: 'Processos', item: 'Editor' });

    await expect(page).toHaveTitle(/^Processos · .+/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Editor de processos' }),
    ).toBeVisible();
    await expect(page.getByLabel('breadcrumb')).toContainText('Processos');
    await expect(
      page.getByRole('main').getByText('Beta', { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('region', { name: 'Blocos' })).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Propriedades' }),
    ).toBeVisible();
    await expect(issueStatus(page)).toHaveText('Sem problemas');
  });

  test('arrasta um bloco, conecta, recusa conexão inválida e desfaz', async ({
    page,
  }) => {
    await openEditor(page);

    await dropBlock(page, 'Etapa');
    await expect(port(page, 'Entrada de Etapa')).toHaveCount(1);
    await expect(issueStatus(page)).toHaveText('2 problemas: 2 erros');
    // WHY: nesta janela o Fim abre abaixo da área visível do canvas; a ligação arrastada até lá faz o canvas rolar
    // sozinho no meio do gesto, e às vezes a ponta é solta fora da porta e abre a escolha de um bloco novo.
    await toolbar(page).getByRole('button', { name: 'Ajustar à tela' }).click();

    await dragBetween({
      page,
      from: port(page, 'Saída de Etapa'),
      to: port(page, 'Entrada de Fim'),
    });
    await expect(issueStatus(page)).toHaveText('1 problema: 1 erro');

    // NOTE: a Etapa já tem a saída ligada e a Primeira etapa já tem entrada, então o editor recusa a conexão.
    await dragBetween({
      page,
      from: port(page, 'Saída de Etapa'),
      to: port(page, 'Entrada de Primeira etapa'),
    });
    await expect(issueStatus(page)).toHaveText('1 problema: 1 erro');
    await expect(canvas(page).locator('.react-flow__edge')).toHaveCount(3);
    await expect(
      page.getByRole('alert').filter({ hasText: 'Conexão recusada' }),
    ).toHaveText(
      'Conexão recusada: o ponto de saída já está ligado a outro bloco.',
    );

    await page.getByRole('button', { name: 'Desfazer' }).click();
    await expect(issueStatus(page)).toHaveText('2 problemas: 2 erros');
    await page.getByRole('button', { name: 'Refazer' }).click();
    await expect(issueStatus(page)).toHaveText('1 problema: 1 erro');
  });

  test('insere pelo botão da biblioteca e edita pelo painel', async ({
    page,
  }) => {
    await openEditor(page);

    await page
      .getByRole('button', { name: 'Inserir Decisão exclusiva' })
      .click();
    const properties = page.getByRole('region', { name: 'Propriedades' });
    await properties.getByLabel('Título').fill('Aprovado?');
    await properties.getByRole('button', { name: 'Adicionar ramo' }).click();

    await expect(
      canvas(page).getByText('Aprovado?', { exact: true }),
    ).toBeVisible();
    await expect(
      canvas(page).getByText('Caminho 3', { exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel('Ramo Caminho 3 de Aprovado?')).toHaveCount(1);
  });

  test('aproxima o canvas pelo controle de zoom', async ({ page }) => {
    await openEditor(page);
    const viewport = canvas(page).locator('.react-flow__viewport');
    const before = await viewport.getAttribute('style');

    await page.getByRole('button', { name: 'Aumentar o zoom' }).click();

    await expect(viewport).not.toHaveAttribute('style', before ?? '');
  });
});

test.describe('editor de processos: canvas', () => {
  test('insere em cascata quando o botão + é usado em seguida', async ({
    page,
  }) => {
    await openEditor(page);
    await expect(nodes(page)).toHaveCount(3);

    await page.getByRole('button', { name: 'Inserir Etapa' }).click();
    await page.getByRole('button', { name: 'Inserir Etapa' }).click();

    await expect(nodes(page)).toHaveCount(5);
    const first = await nodes(page).nth(3).boundingBox();
    const second = await nodes(page).nth(4).boundingBox();
    if (!first || !second) {
      throw new Error('Os blocos inseridos não estão na tela.');
    }
    const stepX = second.x - first.x;
    const stepY = second.y - first.y;
    expect(stepX).toBeGreaterThan(0);
    expect(stepY).toBeCloseTo(stepX, 0);
  });

  test('mostra os blocos do processo no minimapa', async ({ page }) => {
    await openEditor(page);

    const minimap = page.getByLabel('Minimapa');

    await expect(minimap).toBeVisible();
    await expect(minimap.locator('.react-flow__minimap-node')).toHaveCount(3);
  });

  test('pinta o canvas com as cores do tema escolhido no painel', async ({
    page,
  }) => {
    await openEditor(page);
    const lightBackground = await cardBackground(page);
    await expect(canvas(page)).toHaveCSS('background-color', lightBackground);

    await openThemeMenu(page);
    await page.getByRole('button', { name: 'Escuro' }).click();

    await expect(page.locator('html')).toHaveAttribute(
      'data-coreui-theme',
      'dark',
    );
    const darkBackground = await cardBackground(page);
    expect(darkBackground).not.toBe(lightBackground);
    await expect(canvas(page)).toHaveCSS('background-color', darkBackground);
  });
});

/** Folga entre o fim do canvas e o rodapé: só o espaçamento do cartão e da página. */
const CANVAS_FOOTER_MAX_GAP = 48;
/** Em 900 px de altura, o canvas fica com pelo menos 40% da janela. */
const CANVAS_MIN_HEIGHT = 360;

test.describe('editor de processos: tela larga', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('cabe na janela, com o canvas indo até o fim da página', async ({
    page,
  }) => {
    await openEditor(page);

    const box = await canvas(page).boundingBox();
    if (!box) {
      throw new Error('O canvas não está na tela.');
    }
    const footer = await page.getByRole('contentinfo').boundingBox();
    if (!footer) {
      throw new Error('O rodapé não está na tela.');
    }
    expect(footer.y + footer.height).toBeLessThanOrEqual(900);
    // NOTE: a altura do canvas é o que sobra abaixo do seletor de processos, da barra do rascunho e da barra de ações;
    // o que importa é ele ir até o rodapé, sem sobra de tela embaixo.
    const gapToFooter = footer.y - (box.y + box.height);
    expect(gapToFooter).toBeGreaterThanOrEqual(0);
    expect(gapToFooter).toBeLessThanOrEqual(CANVAS_FOOTER_MAX_GAP);
    expect(box.height).toBeGreaterThan(CANVAS_MIN_HEIGHT);
  });
});

test.describe('editor de processos: tela estreita', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('empilha biblioteca, canvas e propriedades', async ({ page }) => {
    await openEditor(page);

    const palette = await page
      .getByRole('region', { name: 'Blocos' })
      .boundingBox();
    const flow = await canvas(page).boundingBox();
    const properties = await page
      .getByRole('region', { name: 'Propriedades' })
      .boundingBox();
    if (!palette || !flow || !properties) {
      throw new Error('Biblioteca, canvas ou propriedades fora da tela.');
    }
    expect(palette.y).toBeLessThan(flow.y);
    expect(flow.y).toBeLessThan(properties.y);
  });
});
