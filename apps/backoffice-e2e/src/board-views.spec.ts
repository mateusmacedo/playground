import { expect, type Page } from '@playwright/test';

import { card, closeCard, openBoard } from './support/board-screen';
import { startProcess } from './support/card-process-screen';
import { test } from './support/mock-test';
import {
  EXAMPLE_PROCESS,
  PURCHASE_PROCESS,
  purchaseDefinition,
} from './support/process-documents';

function cardsTable(page: Page) {
  return page.getByRole('table', { name: 'Cards do quadro, um por linha' });
}

function stepsTable(page: Page) {
  return page.getByRole('table', {
    name: 'Etapas pendentes do quadro, uma por linha',
  });
}

test.describe('quadro kanban: filtro de hierarquia e lista em árvore', () => {
  test('o filtro de hierarquia esmaece os cards fora dele e liga o contador', async ({
    page,
  }) => {
    await openBoard(page);
    const filter = page.getByLabel('Filtrar por hierarquia');

    await filter.selectOption('children');
    await expect(page.getByText('2 de 4 cards')).toBeVisible();
    await expect(card(page, 'Item 1')).toContainText('Fora da busca.');
    await expect(card(page, 'Item 2')).not.toContainText('Fora da busca.');

    await page.getByRole('button', { name: 'Lista' }).click();
    await expect(cardsTable(page).getByRole('row')).toHaveCount(3);

    await filter.selectOption('all');
    await expect(page.getByText(/\d+ de \d+ cards/)).toHaveCount(0);
    await expect(cardsTable(page).getByRole('row')).toHaveCount(5);
  });

  test('a lista em árvore recolhe os filhos e mantém a escolha depois de recarregar', async ({
    page,
  }) => {
    await openBoard(page);
    const list = page.getByRole('button', { name: 'Lista' });
    await list.click();
    await page.getByLabel('Lista em árvore').check();

    const table = cardsTable(page);
    const childRow = table.getByRole('row').filter({ hasText: 'Item 2' });
    await expect(childRow).toContainText('Nível 2:');
    const toggle = table.getByRole('button', { name: 'Filhos de Item 1' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(childRow).toHaveCount(0);

    await page.reload();
    await expect(list).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByLabel('Lista em árvore')).toBeChecked();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(childRow).toHaveCount(0);
    await expect(
      table.getByRole('row').filter({ hasText: 'Item 4' }),
    ).toBeVisible();
  });
});

test.describe('quadro kanban: visão das etapas pendentes', () => {
  test('lista as etapas, filtra por papel e abre o card da linha pelo teclado', async ({
    page,
    mock,
  }) => {
    await mock.seedDefinition(purchaseDefinition());
    await openBoard(page);
    await startProcess({
      page,
      cardTitle: 'Item 4',
      processName: PURCHASE_PROCESS,
    });
    await closeCard(page);
    await startProcess({
      page,
      cardTitle: 'Item 2',
      processName: EXAMPLE_PROCESS,
    });
    await closeCard(page);

    await page.getByRole('button', { name: 'Etapas' }).click();
    const table = stepsTable(page);
    await expect(table.getByRole('rowheader')).toHaveText([
      /Preencher o pedido/,
      /Primeira etapa/,
    ]);
    await expect(page.getByText('2 etapas pendentes')).toBeVisible();
    for (const name of [
      'Card',
      'Coluna',
      'Etapa',
      'Tipo',
      'Papel',
      'Responsável',
      'Desde',
      'Prazo',
    ]) {
      await expect(table.getByRole('columnheader', { name })).toBeVisible();
    }

    const role = page.getByLabel('Papel', { exact: true });
    await role.selectOption('role:Solicitante');
    await expect(table.getByRole('rowheader')).toHaveText([
      /Preencher o pedido/,
    ]);
    await expect(page.getByText('1 de 2 etapas pendentes')).toBeVisible();
    await role.selectOption('none');
    await expect(table.getByRole('rowheader')).toHaveText([/Primeira etapa/]);

    const open = table.getByRole('button', { name: 'Item 2', exact: true });
    await open.focus();
    await page.keyboard.press('Enter');
    const details = page.getByRole('dialog', { name: 'Detalhes do card' });
    await expect(details.getByLabel('Título')).toHaveValue('Item 2');
    await details.getByRole('button', { name: 'Fechar os detalhes' }).click();
    await expect(open).toBeFocused();
  });

  test('sem processo em andamento, mostra o estado vazio', async ({ page }) => {
    await openBoard(page);

    await page.getByRole('button', { name: 'Etapas' }).click();

    await expect(
      page.getByText('Nenhuma etapa pendente no quadro.'),
    ).toBeVisible();
    await expect(
      page.getByText(
        'As etapas dos processos em andamento nos cards aparecem aqui.',
      ),
    ).toBeVisible();
    await expect(stepsTable(page)).toHaveCount(0);
  });
});
