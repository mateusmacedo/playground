import { expect } from '@playwright/test';

import { savedCardTitles } from './support/board-documents';
import {
  addCard,
  card,
  cardTitles,
  lane,
  openBoard,
  openCard,
} from './support/board-screen';
import { test } from './support/mock-test';
import { menuLink } from './support/side-menu';

test.describe('quadro kanban', () => {
  test('abre pelo menu lateral com título e colunas', async ({ page }) => {
    await page.goto('/');
    await menuLink(page, 'Quadro').click();

    await expect(page).toHaveTitle(/^Quadro · .+/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Quadro' }),
    ).toBeVisible();
    await expect(page.getByLabel('breadcrumb')).toContainText('Quadro');
    await expect(
      page.getByRole('main').getByText('Beta', { exact: true }),
    ).toBeVisible();
    // NOTE: as 3 colunas dos dados iniciais do mock e a coluna automática dos arquivados.
    await expect(page.getByRole('main').getByRole('region')).toHaveCount(4);
  });

  test('arrasta um card para a coluna vazia', async ({ page }) => {
    await openBoard(page);

    await card(page, 'Item 1').dragTo(lane(page, 'Concluído'));

    await expect(cardTitles(page, 'Concluído')).toHaveText(['Item 1']);
    await expect(cardTitles(page, 'A fazer')).toHaveText(['Item 2', 'Item 3']);
  });

  test('move um card pelo teclado e solta com Espaço', async ({ page }) => {
    await openBoard(page);
    const handle = page.getByRole('button', { name: 'Mover Item 2' });

    await handle.click();
    await expect(handle).toHaveAttribute('aria-pressed', 'true');

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
    await openBoard(page);

    await page.getByRole('button', { name: 'Adicionar coluna' }).click();
    const name = page.getByRole('textbox', { name: 'Nome da nova coluna' });
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
    // NOTE: a coluna automática dos arquivados fica sempre por último.
    await expect(
      page.getByRole('main').getByRole('heading', { level: 2 }),
    ).toHaveText([
      'A fazer',
      'Em andamento',
      'Homologação',
      'Concluído',
      'Arquivados',
    ]);
  });

  test('abre o card pelo clique, edita o título e define o card pai', async ({
    page,
  }) => {
    await openBoard(page);

    const details = await openCard(page, 'Item 4');
    await expect(details).toBeFocused();

    await details.getByLabel('Título').fill('Item 4 revisado');
    await details
      .getByLabel('Card pai')
      .selectOption({ label: 'Item 1 (A fazer)' });
    const revised = card(page, 'Item 4 revisado');
    await expect(revised).toContainText('Filho de Item 1');

    await page.keyboard.press('Escape');
    await expect(details).toBeHidden();
    await expect(
      revised.getByRole('button', { name: 'Item 4 revisado', exact: true }),
    ).toBeFocused();
  });

  test('mantém o quadro depois de recarregar a página', async ({
    page,
    mock,
  }) => {
    await openBoard(page);
    await addCard({
      page,
      laneName: 'Em andamento',
      title: 'Card gravado',
    });
    await expect(cardTitles(page, 'Em andamento')).toHaveText([
      'Item 4',
      'Card gravado',
    ]);
    // WHY: o painel grava no servidor um instante depois da mudança; recarregar antes disso traria o quadro antigo.
    await expect
      .poll(() => savedCardTitles({ mock, laneTitle: 'Em andamento' }))
      .toEqual(['Item 4', 'Card gravado']);

    await page.reload();

    await expect(cardTitles(page, 'Em andamento')).toHaveText([
      'Item 4',
      'Card gravado',
    ]);
  });
});
