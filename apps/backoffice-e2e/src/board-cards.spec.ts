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

test.describe('quadro kanban: busca, desfazer, arquivo e dados do card', () => {
  test('a busca esmaece os cards que não batem e a barra leva até ela', async ({
    page,
  }) => {
    await openBoard(page);
    const search = page.getByRole('searchbox', { name: 'Buscar cards' });

    await page.locator('body').press('/');
    await expect(search).toBeFocused();

    await page.keyboard.type('qd-4');
    await expect(page.getByText('1 de 4 cards')).toBeVisible();
    await expect(card(page, 'Item 1')).toHaveClass(/kanban-card--dimmed/);
    await expect(card(page, 'Item 4')).not.toHaveClass(/kanban-card--dimmed/);
  });

  test('desfaz o arraste com Ctrl+Z e refaz com Ctrl+Shift+Z', async ({
    page,
  }) => {
    await openBoard(page);
    await card(page, 'Item 4').dragTo(lane(page, 'Concluído'));
    await expect(cardTitles(page, 'Concluído')).toHaveText(['Item 4']);

    await page.locator('body').press('Control+z');
    await expect(cardTitles(page, 'Em andamento')).toHaveText(['Item 4']);
    await page.locator('body').press('Control+Shift+z');
    await expect(cardTitles(page, 'Concluído')).toHaveText(['Item 4']);
  });

  test('arquiva o card pelo painel e restaura pela lista de arquivados', async ({
    page,
  }) => {
    await openBoard(page);
    const details = await openCard(page, 'Item 4');
    await details.getByRole('button', { name: 'Arquivar card' }).click();
    await expect(cardTitles(page, 'Em andamento')).toHaveCount(0);

    await page.getByRole('button', { name: 'Arquivados (1)' }).click();
    const list = page.getByRole('dialog', { name: 'Cards arquivados' });
    await list.getByRole('button', { name: 'Restaurar Item 4' }).click();
    await list.getByRole('button', { name: 'Fechar', exact: true }).click();
    await expect(cardTitles(page, 'Em andamento')).toHaveText(['Item 4']);
  });

  test('abre o card pelo endereço e marca etiqueta e checklist', async ({
    page,
  }) => {
    await page.goto('/quadro?card=QD-1');
    const details = page.getByRole('dialog', { name: 'Detalhes do card' });
    await expect(details.getByLabel('Título')).toHaveValue('Item 1');

    await details
      .getByRole('group', { name: 'Etiquetas' })
      .getByRole('checkbox', { name: 'Urgente' })
      .check();
    await details.getByRole('checkbox', { name: 'Segundo passo' }).check();
    await expect(card(page, 'Item 1')).toContainText('Urgente');
    await expect(card(page, 'Item 1')).toContainText(
      'Checklist: 2 de 2 itens feitos',
    );

    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /^Etiquetas/ }).click();
    await page
      .getByRole('group', { name: 'Mostrar cards com' })
      .getByRole('checkbox', { name: 'Urgente' })
      .check();
    await expect(card(page, 'Item 2')).toHaveClass(/kanban-card--dimmed/);
    await expect(card(page, 'Item 4')).not.toHaveClass(/kanban-card--dimmed/);
  });

  test('cria outro quadro com prefixo próprio e volta ao principal', async ({
    page,
    mock,
  }) => {
    await openBoard(page);
    await page.getByRole('button', { name: 'Novo quadro' }).click();
    const dialog = page.getByRole('dialog', { name: 'Novo quadro' });
    await dialog.getByLabel('Nome do quadro').fill('Operações de TI');
    await expect(dialog.getByLabel('Prefixo do código dos cards')).toHaveValue(
      'ODT',
    );
    await dialog.getByRole('button', { name: 'Criar' }).click();

    await expect(page).toHaveURL(/quadro=board-2/);
    await addCard({ page, laneName: 'A fazer', title: 'Trocar servidor' });
    await expect(lane(page, 'A fazer').getByText('ODT-1')).toBeVisible();
    // WHY: o quadro novo e o card dele são gravados no servidor um instante depois; recarregar antes disso abriria o
    // quadro principal, o único que o servidor conhece.
    await expect
      .poll(() =>
        savedCardTitles({ mock, boardId: 'board-2', laneTitle: 'A fazer' }),
      )
      .toEqual(['Trocar servidor']);

    await page.reload();
    await expect(page.getByLabel('Quadro', { exact: true })).toHaveValue(
      'board-2',
    );
    await expect(cardTitles(page, 'A fazer')).toHaveText(['Trocar servidor']);

    await page.getByLabel('Quadro', { exact: true }).selectOption({
      label: 'Quadro principal',
    });
    await expect(page).toHaveURL(/quadro=board-1/);
    await expect(cardTitles(page, 'A fazer').first()).toHaveText('Item 1');
  });

  test('oculta, bloqueia e arquiva pela coluna de arquivados', async ({
    page,
  }) => {
    // WHY: o arraste precisa do card e da coluna de arquivados, a última, na tela ao mesmo tempo.
    await page.setViewportSize({ width: 1680, height: 900 });
    await openBoard(page);
    const doing = lane(page, 'Em andamento');
    await page
      .getByRole('button', { name: 'Ações da coluna Em andamento' })
      .click();
    await doing.getByRole('button', { name: 'Bloquear coluna' }).click();
    await expect(doing.getByText(/^Coluna bloqueada: libere/)).toBeVisible();
    await expect(
      doing.getByRole('button', { name: 'Adicionar card' }),
    ).toHaveCount(0);

    const archive = lane(page, 'Arquivados');
    await card(page, 'Item 1').dragTo(
      archive.getByRole('heading', { name: 'Arquivados' }),
    );
    await expect(archive.getByText('Item 1')).toBeVisible();
    await archive
      .getByRole('button', { name: 'Ver Item 1, arquivado' })
      .click();
    const view = page.getByRole('dialog', { name: /^Card arquivado QD-1/ });
    await expect(view.getByText('Só leitura', { exact: false })).toBeVisible();
    await view.getByRole('button', { name: 'Fechar' }).click();

    await page
      .getByRole('button', { name: 'Ações da coluna Concluído' })
      .click();
    await lane(page, 'Concluído')
      .getByRole('button', { name: 'Ocultar coluna' })
      .click();
    await expect(lane(page, 'Concluído')).toHaveCount(0);
    await page.getByRole('button', { name: 'Colunas ocultas (1)' }).click();
    await page.getByRole('button', { name: 'Mostrar Concluído' }).click();
    await expect(lane(page, 'Concluído')).toBeVisible();
  });

  test('configura conclusão e pessoas, e o card ganha responsável, comentário e anexo', async ({
    page,
  }) => {
    await openBoard(page);
    await page.getByRole('button', { name: 'Configurar quadro' }).click();
    const dialog = page.getByRole('dialog', { name: 'Configurar quadro' });
    await dialog
      .getByLabel('Coluna de conclusão')
      .selectOption({ label: 'Em andamento' });
    await dialog.getByLabel('Nome da nova pessoa').fill('Ana Souza');
    await dialog.getByLabel('Nome da nova pessoa').press('Enter');
    await dialog.getByRole('button', { name: 'Salvar' }).click();
    await expect(dialog).toBeHidden();

    const parent = card(page, 'Item 1');
    await expect(parent).toContainText('0/2 filhos');

    const details = await openCard(page, 'Item 2');
    await details
      .getByLabel('Responsável')
      .selectOption({ label: 'Ana Souza' });
    await details.getByLabel('Novo comentário').fill('Revisar amanhã');
    await details.getByRole('button', { name: 'Comentar' }).click();
    await details.getByLabel('Endereço do link').fill('https://exemplo.com');
    await details.getByRole('button', { name: 'Anexar link' }).click();
    await details.getByLabel('Coluna').selectOption({ label: 'Em andamento' });

    await expect(parent).toContainText('1/2 filhos');
    await expect(card(page, 'Item 2')).toContainText('AS');
    await expect(details.getByText('Revisar amanhã')).toBeVisible();
    await expect(
      details.getByRole('link', { name: 'https://exemplo.com' }),
    ).toBeVisible();
  });

  test('mostra a lista ordenável e as linhas por card pai', async ({
    page,
  }) => {
    await openBoard(page);
    await page.getByRole('button', { name: 'Lista' }).click();
    const table = page.getByRole('table');
    await expect(table.getByRole('row')).toHaveCount(5);
    await table.getByRole('button', { name: 'Coluna' }).click();
    await table.getByRole('button', { name: 'Coluna' }).click();
    await expect(table.getByRole('row').nth(1)).toContainText('Em andamento');

    await page.getByRole('button', { name: 'Quadro', exact: true }).click();
    await page.getByLabel('Linhas por card pai').check();
    const parentRow = page.getByRole('region', { name: 'QD-1 Item 1' });
    await expect(
      parentRow.getByRole('group', { name: 'A fazer em Item 1' }),
    ).toContainText('Item 2');
    await expect(
      page.getByRole('region', { name: 'Sem card pai' }),
    ).toContainText('Item 4');
  });
});
