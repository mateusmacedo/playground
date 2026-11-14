import { expect, type Page, test } from '@playwright/test';

const THEME_TOGGLE_NAME = 'Escolher o tema';

/** Abre o menu de tema sem fechá-lo: só clica enquanto ele está fechado (`aria-expanded` diferente de `true`). */
async function openThemeMenu(page: Page) {
  const toggle = page.getByRole('button', { name: THEME_TOGGLE_NAME });
  // WHY: o HTML chega antes da hidratação do React e um clique nesse intervalo se perde, então repete até abrir; a
  // checagem do `aria-expanded` impede que uma repetição feche o menu que o clique anterior já abriu.
  await expect(async () => {
    if ((await toggle.getAttribute('aria-expanded')) !== 'true') {
      await toggle.click();
    }
    await expect(toggle).toHaveAttribute('aria-expanded', 'true', {
      timeout: 1000,
    });
  }).toPass();
}

test.describe('shell do painel', () => {
  test('mostra menu lateral, cabeçalho com breadcrumb, conteúdo e rodapé', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/^Início · .+/);
    await expect(
      page
        .getByRole('navigation', { name: 'Menu lateral', exact: true })
        .getByRole('link', { name: 'Início' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Início' }),
    ).toBeVisible();
    await expect(page.getByLabel('breadcrumb')).toContainText('Início');
    await expect(page.getByRole('contentinfo')).toContainText('ambiente');
  });

  test('troca o tema e lembra a escolha ao recarregar', async ({ page }) => {
    await page.goto('/');

    await openThemeMenu(page);
    await page.getByRole('button', { name: 'Escuro' }).click();
    await expect(page.locator('html')).toHaveAttribute(
      'data-coreui-theme',
      'dark',
    );

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute(
      'data-coreui-theme',
      'dark',
    );
  });

  test('mostra a página 404 fora do painel', async ({ page }) => {
    await page.goto('/rota-que-nao-existe');

    await expect(
      page.getByRole('heading', { name: 'Página não encontrada' }),
    ).toBeVisible();
    await expect(
      page.getByRole('navigation', { name: 'Menu lateral', exact: true }),
    ).toHaveCount(0);
  });
});

test.describe('com o armazenamento do navegador bloqueado', () => {
  test.use({ colorScheme: 'dark' });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      Storage.prototype.getItem = () => {
        throw new DOMException('bloqueado', 'SecurityError');
      };
    });
  });

  test('o painel abre e o tema segue o sistema', async ({ page }) => {
    await page.goto('/');

    // WHY: o menu só abre depois da hidratação; se o cabeçalho tivesse caído por causa do armazenamento, o HTML do
    // servidor ainda mostraria tudo até aqui e só este passo falharia.
    await openThemeMenu(page);

    await expect(
      page.getByRole('heading', { level: 1, name: 'Início' }),
    ).toBeVisible();
    await expect(page.getByText('Algo deu errado')).toHaveCount(0);
    await expect(page.locator('html')).toHaveAttribute(
      'data-coreui-theme',
      'dark',
    );
  });

  test('a troca de tema ainda funciona na sessão da página', async ({
    page,
  }) => {
    await page.goto('/');

    await openThemeMenu(page);
    await page.getByRole('button', { name: 'Claro' }).click();

    await expect(page.locator('html')).toHaveAttribute(
      'data-coreui-theme',
      'light',
    );
  });
});
