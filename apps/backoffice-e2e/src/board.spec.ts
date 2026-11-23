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
});
