import { expect, type Locator, type Page, test } from '@playwright/test';

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
    .filter({ hasText: label });
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

    await page
      .getByLabel('Saída de Etapa', { exact: true })
      .dragTo(page.getByLabel('Entrada de Fim', { exact: true }));
    await expect(issueStatus(page)).toHaveText('1 problema');

    // NOTE: a Etapa já tem a saída ligada e a Primeira etapa já tem entrada, então o editor recusa a conexão.
    await page
      .getByLabel('Saída de Etapa', { exact: true })
      .dragTo(page.getByLabel('Entrada de Primeira etapa', { exact: true }));
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

    await page.getByRole('button', { name: 'Inserir Decisão' }).click();
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
