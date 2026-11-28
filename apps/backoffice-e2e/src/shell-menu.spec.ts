import { expect, type Locator, type Page, test } from '@playwright/test';

import { boxOf } from './support/box';
import {
  menuLink,
  openByMenu,
  openMenuGroup,
  sideMenu,
} from './support/side-menu';

/** Os itens do menu marcados como a página atual; o menu marca um só. */
function currentItems(page: Page): Locator {
  return sideMenu(page).locator('[aria-current="page"]');
}

function pageTitle(page: Page, name: string): Locator {
  return page.getByRole('heading', { level: 1, name });
}

test.describe('menu lateral: grupo Processos', () => {
  test('mostra Editor e Execuções só com o grupo aberto', async ({ page }) => {
    await page.goto('/');
    await expect(menuLink(page, 'Processos')).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    await expect(menuLink(page, 'Editor')).toBeHidden();
    await expect(menuLink(page, 'Execuções')).toBeHidden();

    await openMenuGroup(page, 'Processos');

    await expect(menuLink(page, 'Editor')).toHaveAttribute(
      'href',
      '/processos',
    );
    await expect(menuLink(page, 'Execuções')).toHaveAttribute(
      'href',
      '/processos/execucao',
    );
  });

  test('em /processos, abre o grupo e marca só o Editor', async ({ page }) => {
    await page.goto('/processos');

    await expect(pageTitle(page, 'Editor de processos')).toBeVisible();
    await expect(currentItems(page)).toHaveText(['Editor']);
    await expect(menuLink(page, 'Processos')).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  test('em /processos/execucao, marca só Execuções e mostra o breadcrumb até ela', async ({
    page,
  }) => {
    await page.goto('/processos/execucao');

    await expect(page).toHaveTitle(/^Execuções · .+/);
    await expect(pageTitle(page, 'Execuções')).toBeVisible();
    await expect(currentItems(page)).toHaveText(['Execuções']);
    await expect(menuLink(page, 'Processos')).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    const crumbs = page.getByLabel('breadcrumb').getByRole('listitem');
    await expect(crumbs).toHaveText(['Início', 'Processos', 'Execuções']);
    await expect(
      crumbs.getByRole('link', { name: 'Processos' }),
    ).toHaveAttribute('href', '/processos');
    await expect(crumbs.last()).toHaveAttribute('aria-current', 'page');
  });

  test('leva de Execuções ao Editor e fecha o grupo ao sair para o Quadro', async ({
    page,
  }) => {
    await page.goto('/');
    await openByMenu({ page, group: 'Processos', item: 'Execuções' });
    await expect(page).toHaveURL(/\/processos\/execucao$/);
    await expect(pageTitle(page, 'Execuções')).toBeVisible();
    await expect(currentItems(page)).toHaveText(['Execuções']);

    await menuLink(page, 'Editor').click();
    await expect(pageTitle(page, 'Editor de processos')).toBeVisible();
    await expect(currentItems(page)).toHaveText(['Editor']);

    await menuLink(page, 'Quadro').click();
    await expect(pageTitle(page, 'Quadro')).toBeVisible();
    await expect(currentItems(page)).toHaveText([/^Quadro/]);
    await expect(menuLink(page, 'Processos')).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });
});

test.describe('menu lateral estreito', () => {
  /** Acima disto o menu está inteiro: estreito ele tem 64 px e inteiro, 256 px. */
  const NARROW_MAX_WIDTH = 100;
  /** Um ponto do conteúdo, longe do menu. */
  const OUTSIDE_MENU = { x: 800, y: 400 };

  async function menuWidth(page: Page): Promise<number> {
    const box = await boxOf(sideMenu(page));
    return box.width;
  }

  /** Estreita o menu pelo botão do rodapé dele e tira o ponteiro de cima, porque o menu estreito abre sob o ponteiro. */
  async function narrowMenu(page: Page) {
    const toggler = page.getByRole('button', {
      name: 'Recolher ou expandir o menu lateral',
    });
    // WHY: o HTML chega antes da hidratação e um clique nesse intervalo se perde, então repete até estreitar; a
    // checagem da largura impede que uma repetição alargue o menu que o clique anterior já estreitou.
    await expect(async () => {
      if ((await menuWidth(page)) > NARROW_MAX_WIDTH) {
        await toggler.click();
        await page.mouse.move(OUTSIDE_MENU.x, OUTSIDE_MENU.y);
      }
      await expect
        .poll(() => menuWidth(page), { timeout: 2000 })
        .toBeLessThan(NARROW_MAX_WIDTH);
    }).toPass();
  }

  test('abre inteiro para quem chega pelo teclado e deixa alcançar Editor e Execuções', async ({
    page,
  }) => {
    await page.goto('/');
    await narrowMenu(page);

    await page.keyboard.press('Shift+Tab');
    const group = menuLink(page, 'Processos');
    await expect(group).toBeFocused();
    await expect.poll(() => menuWidth(page)).toBeGreaterThan(NARROW_MAX_WIDTH);

    await page.keyboard.press('Enter');
    await expect(group).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Tab');
    await expect(menuLink(page, 'Editor')).toBeFocused();
    await expect(menuLink(page, 'Editor')).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(menuLink(page, 'Execuções')).toBeFocused();
    await expect(menuLink(page, 'Execuções')).toBeVisible();

    await page.keyboard.press('Enter');
    await expect(pageTitle(page, 'Execuções')).toBeVisible();
    await expect(currentItems(page)).toHaveText(['Execuções']);
  });
});
