import { expect, test } from '@playwright/test';

test.describe('shell do painel', () => {
  test('mostra menu lateral, cabeçalho com breadcrumb, conteúdo e rodapé', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(page).toHaveTitle('Início · Backoffice');
    await expect(
      page.locator('#sidebar').getByRole('link', { name: 'Início' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Início' }),
    ).toBeVisible();
    await expect(page.getByLabel('breadcrumb')).toContainText('Início');
    await expect(page.getByRole('contentinfo')).toContainText('ambiente');
  });

  test('troca o tema e lembra a escolha ao recarregar', async ({ page }) => {
    await page.goto('/');

    const dark = page.getByRole('button', { name: 'Escuro' });
    // WHY: o HTML chega antes da hidratação do React; um clique nesse intervalo se perde, então repete até abrir.
    await expect(async () => {
      await page.getByRole('button', { name: 'Escolher o tema' }).click();
      await expect(dark).toBeVisible({ timeout: 1000 });
    }).toPass();
    await dark.click();
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
    await expect(page.locator('#sidebar')).toHaveCount(0);
  });
});
