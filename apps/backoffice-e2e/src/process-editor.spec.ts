import { expect, type Locator, type Page, test } from '@playwright/test';

import { dragBetween } from './flow-drag';
import { openThemeMenu } from './theme-menu';

// WHY: com a largura padrão o canvas fica estreito, e o bloco solto cairia em cima dos blocos do exemplo.
test.use({ viewport: { width: 1600, height: 1000 } });

function canvas(page: Page): Locator {
  return page.getByLabel('Canvas do processo');
}

function issueStatus(page: Page): Locator {
  return page
    .getByRole('toolbar', { name: 'Ações do editor' })
    .getByRole('status');
}

/** Cor de fundo do cartão da página, que usa a mesma variável do tema (`--cui-body-bg`) que o canvas. */
async function cardBackground(page: Page): Promise<string> {
  // WHY: o tsconfig do e2e não carrega os tipos do DOM; a expressão em texto roda no navegador sem precisar deles.
  return page.evaluate<string>(
    "getComputedStyle(document.querySelector('.process-editor').closest('.card')).backgroundColor",
  );
}

/** Abre o editor e espera o React Flow medir os blocos, o que só acontece depois da hidratação. */
async function openEditor(page: Page) {
  await page.goto('/processos');
  await expect(canvas(page).getByText('Primeira etapa')).toBeVisible();
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
    await page
      .getByRole('navigation', { name: 'Menu lateral', exact: true })
      .getByRole('link', { name: 'Processos' })
      .click();

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
    await expect(
      page.getByLabel('Entrada de Etapa', { exact: true }),
    ).toHaveCount(1);
    await expect(issueStatus(page)).toHaveText('2 problemas');

    await dragBetween({
      page,
      from: page.getByLabel('Saída de Etapa', { exact: true }),
      to: page.getByLabel('Entrada de Fim', { exact: true }),
    });
    await expect(issueStatus(page)).toHaveText('1 problema');

    // NOTE: a Etapa já tem a saída ligada e a Primeira etapa já tem entrada, então o editor recusa a conexão.
    await dragBetween({
      page,
      from: page.getByLabel('Saída de Etapa', { exact: true }),
      to: page.getByLabel('Entrada de Primeira etapa', { exact: true }),
    });
    await expect(issueStatus(page)).toHaveText('1 problema');
    await expect(canvas(page).locator('.react-flow__edge')).toHaveCount(3);

    await page.getByRole('button', { name: 'Desfazer' }).click();
    await expect(issueStatus(page)).toHaveText('2 problemas');
    await page.getByRole('button', { name: 'Refazer' }).click();
    await expect(issueStatus(page)).toHaveText('1 problema');
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
    const nodes = canvas(page).locator('.react-flow__node');
    await expect(nodes).toHaveCount(3);

    await page.getByRole('button', { name: 'Inserir Etapa' }).click();
    await page.getByRole('button', { name: 'Inserir Etapa' }).click();

    await expect(nodes).toHaveCount(5);
    const first = await nodes.nth(3).boundingBox();
    const second = await nodes.nth(4).boundingBox();
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
    expect(box.y + box.height).toBeLessThanOrEqual(900);
    expect(box.height).toBeGreaterThan(450);
    const footer = await page.getByRole('contentinfo').boundingBox();
    if (!footer) {
      throw new Error('O rodapé não está na tela.');
    }
    expect(footer.y + footer.height).toBeLessThanOrEqual(900);
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
