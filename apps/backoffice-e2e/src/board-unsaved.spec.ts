import { type Dialog, expect, type Page } from '@playwright/test';

import { savedCardTitles } from './support/board-documents';
import { addCard, cardTitles, openBoard } from './support/board-screen';
import { test } from './support/mock-test';

/** Recarrega a página e devolve os tipos dos diálogos que o navegador abriu nesse meio-tempo. */
async function reloadWatchingDialogs(page: Page): Promise<readonly string[]> {
  const seen: string[] = [];
  const onDialog = async (dialog: Dialog) => {
    seen.push(dialog.type());
    await dialog.accept();
  };
  page.on('dialog', onDialog);
  await page.reload();
  await expect(cardTitles(page, 'A fazer').first()).toBeVisible();
  page.off('dialog', onDialog);
  return seen;
}

test.describe('quadro kanban: aviso ao sair com mudança não gravada', () => {
  test('com a gravação falhando, recarregar a página pede confirmação ao navegador', async ({
    page,
    mockScenario,
  }) => {
    await openBoard(page);
    await mockScenario.start('unavailable');
    await addCard({ page, laneName: 'Em andamento', title: 'Card pendente' });
    await expect(
      page.getByRole('alert').filter({
        hasText: 'As últimas mudanças ainda não foram gravadas no servidor',
      }),
    ).toBeVisible();
    await mockScenario.stop();

    expect(await reloadWatchingDialogs(page)).toEqual(['beforeunload']);
  });

  test('com tudo gravado, recarrega sem aviso', async ({ page, mock }) => {
    await openBoard(page);
    await addCard({ page, laneName: 'Em andamento', title: 'Card gravado' });
    await expect
      .poll(() => savedCardTitles({ mock, laneTitle: 'Em andamento' }))
      .toEqual(['Item 4', 'Card gravado']);

    expect(await reloadWatchingDialogs(page)).toEqual([]);
    await expect(cardTitles(page, 'Em andamento')).toHaveText([
      'Item 4',
      'Card gravado',
    ]);
  });
});
