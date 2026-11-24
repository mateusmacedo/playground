import { expect, type Locator, type Page, test } from '@playwright/test';

function lane(page: Page, name: string): Locator {
  return page.getByRole('region', { name });
}

function cardTitles(page: Page, laneName: string): Locator {
  return lane(page, laneName).getByRole('heading', { level: 3 });
}

test.describe('quadro kanban', () => {
  test('abre pelo menu lateral com título e colunas', async ({ page }) => {
    await page.goto('/');
    await page
      .getByRole('navigation', { name: 'Menu lateral', exact: true })
      .getByRole('link', { name: 'Quadro' })
      .click();

    await expect(page).toHaveTitle(/^Quadro · .+/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Quadro' }),
    ).toBeVisible();
    await expect(page.getByLabel('breadcrumb')).toContainText('Quadro');
    await expect(page.getByRole('main').getByRole('region')).toHaveCount(3);
  });

  test('arrasta um card para a coluna vazia', async ({ page }) => {
    await page.goto('/quadro');
    const card = page
      .getByRole('listitem')
      .filter({ has: page.getByRole('heading', { name: 'Item 1' }) });
    const target = lane(page, 'Concluído');

    // WHY: o HTML chega antes da hidratação e um arraste nesse intervalo não move nada, então repete até mover.
    // Repetir é seguro: soltar o card no fim da coluna em que ele já está não muda o quadro.
    await expect(async () => {
      await card.dragTo(target);
      await expect(cardTitles(page, 'Concluído')).toHaveText(['Item 1'], {
        timeout: 1000,
      });
    }).toPass();
    await expect(cardTitles(page, 'A fazer')).toHaveText(['Item 2', 'Item 3']);
  });

  test('move um card pelo teclado e solta com Espaço', async ({ page }) => {
    await page.goto('/quadro');
    const handle = page.getByRole('button', { name: 'Mover Item 2' });

    // WHY: mesmo motivo da hidratação; a checagem do `aria-pressed` impede que uma repetição solte o card já pego.
    await expect(async () => {
      if ((await handle.getAttribute('aria-pressed')) !== 'true') {
        await handle.click();
      }
      await expect(handle).toHaveAttribute('aria-pressed', 'true', {
        timeout: 1000,
      });
    }).toPass();

    await handle.focus();
    await page.keyboard.press('ArrowRight');
    await expect(cardTitles(page, 'Em andamento')).toHaveText([
      'Item 4',
      'Item 2',
    ]);
    await expect(handle).toBeFocused();

    await page.keyboard.press('Space');
    await expect(handle).toHaveAttribute('aria-pressed', 'false');
    await expect(cardTitles(page, 'A fazer')).toHaveText(['Item 1', 'Item 3']);
  });

  test('cria uma coluna, renomeia e muda a posição dela pelo teclado', async ({
    page,
  }) => {
    await page.goto('/quadro');
    const addLane = page.getByRole('button', { name: 'Adicionar coluna' });
    const name = page.getByRole('textbox', { name: 'Nome da nova coluna' });

    // WHY: antes da hidratação o botão não abre o campo; repete o clique até o campo aparecer.
    await expect(async () => {
      if (await addLane.isVisible()) {
        await addLane.click();
      }
      await expect(name).toBeVisible({ timeout: 1000 });
    }).toPass();
    await name.fill('Revisão');
    await name.press('Enter');
    await expect(lane(page, 'Revisão')).toBeVisible();

    await page.getByRole('button', { name: 'Ações da coluna Revisão' }).click();
    await page.getByRole('button', { name: 'Renomear' }).click();
    const rename = page.getByRole('textbox', { name: 'Nome da coluna' });
    await rename.fill('Homologação');
    await rename.press('Enter');

    const handle = page.getByRole('button', {
      name: 'Mover a coluna Homologação',
    });
    await handle.click();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Space');
    await expect(
      page.getByRole('main').getByRole('heading', { level: 2 }),
    ).toHaveText(['A fazer', 'Em andamento', 'Homologação', 'Concluído']);
  });

  test('abre o card pelo clique, edita o título e define o card pai', async ({
    page,
  }) => {
    await page.goto('/quadro');
    const open = page.getByRole('button', { name: 'Item 4', exact: true });
    const details = page.getByRole('dialog', { name: 'Detalhes do card' });

    // WHY: mesmo motivo da hidratação; o clique só abre o painel depois dela.
    await expect(async () => {
      if (!(await details.isVisible())) {
        await open.click();
      }
      await expect(details).toBeVisible({ timeout: 1000 });
    }).toPass();
    await expect(details).toBeFocused();

    await details.getByLabel('Título').fill('Item 4 revisado');
    await details
      .getByLabel('Card pai')
      .selectOption({ label: 'Item 1 (A fazer)' });
    const card = page
      .getByRole('listitem')
      .filter({ has: page.getByRole('heading', { name: 'Item 4 revisado' }) });
    await expect(card).toContainText('Filho de Item 1');

    await page.keyboard.press('Escape');
    await expect(details).toBeHidden();
    await expect(
      card.getByRole('button', { name: 'Item 4 revisado', exact: true }),
    ).toBeFocused();
  });

  test('mantém o quadro depois de recarregar a página', async ({ page }) => {
    await page.goto('/quadro');
    const doing = lane(page, 'Em andamento');
    const addCard = doing.getByRole('button', { name: 'Adicionar card' });
    const title = doing.getByRole('textbox', {
      name: 'Título do novo card em Em andamento',
    });

    await expect(async () => {
      if (await addCard.isVisible()) {
        await addCard.click();
      }
      await expect(title).toBeVisible({ timeout: 1000 });
    }).toPass();
    await title.fill('Card gravado');
    await title.press('Enter');
    await expect(cardTitles(page, 'Em andamento')).toHaveText([
      'Item 4',
      'Card gravado',
    ]);

    await page.reload();
    await expect(cardTitles(page, 'Em andamento')).toHaveText([
      'Item 4',
      'Card gravado',
    ]);
  });
});
