import { expect } from '@playwright/test';
import {
  announcement,
  card,
  cardSection,
  cardTitles,
  closeCard,
  openBoard,
  openCard,
} from './support/board-screen';
import {
  withCardFields,
  withCardMoved,
  withDoneLane,
} from './support/board-setup';
import { initialBoard } from './support/mock-samples';
import { test } from './support/mock-test';

test.describe('quadro kanban: dependências entre cards', () => {
  test('adiciona e remove o bloqueador, com o selo no card e na lista e "Bloqueia" no outro card', async ({
    page,
  }) => {
    await openBoard(page);
    const dependencies = cardSection(
      await openCard(page, 'Item 4'),
      'Dependências',
    );
    await expect(dependencies).toContainText('Nenhum bloqueador.');
    const add = dependencies.getByRole('button', {
      name: 'Adicionar bloqueador',
    });
    await expect(add).toBeDisabled();

    await dependencies
      .getByLabel('Novo bloqueador')
      .selectOption({ label: 'Item 3 (A fazer)' });
    await add.click();

    await expect(
      dependencies.getByRole('list', { name: 'Bloqueado por' }),
    ).toContainText('Item 3 (A fazer) Pendente');
    await expect(announcement(page)).toHaveText(
      'Card Item 3 passou a bloquear Item 4.',
    );
    await expect(card(page, 'Item 4')).toContainText('Bloqueado');

    await closeCard(page);
    const blocks = cardSection(await openCard(page, 'Item 3'), 'Dependências');
    await expect(blocks.getByRole('list', { name: 'Bloqueia' })).toContainText(
      'Item 4 (Em andamento)',
    );
    await closeCard(page);

    await page.getByRole('button', { name: 'Lista' }).click();
    const rowOf = (title: string) =>
      page.getByRole('row').filter({ hasText: title });
    await expect(rowOf('Item 4')).toContainText('Bloqueado');
    await expect(rowOf('Item 3')).not.toContainText('Bloqueado');

    await page.getByRole('button', { name: 'Quadro', exact: true }).click();
    const again = cardSection(await openCard(page, 'Item 4'), 'Dependências');
    await again
      .getByRole('button', { name: 'Remover o bloqueador Item 3' })
      .click();
    await expect(again).toContainText('Nenhum bloqueador.');
    await expect(announcement(page)).toHaveText(
      'Card Item 3 deixou de bloquear Item 4.',
    );
    await expect(card(page, 'Item 4')).not.toContainText('Bloqueado');
  });
});

test.describe('quadro kanban: hierarquia de cards', () => {
  test('converte o item do checklist em card filho e desfaz num passo só', async ({
    page,
  }) => {
    await openBoard(page);
    const details = await openCard(page, 'Item 1');

    await details
      .getByRole('button', {
        name: 'Converter o item Segundo passo em card filho',
      })
      .click();

    await expect(
      details.getByRole('checkbox', { name: 'Segundo passo' }),
    ).toHaveCount(0);
    await expect(
      details
        .getByRole('region', { name: /^Cards filhos/ })
        .getByRole('button', { name: 'Segundo passo' }),
    ).toBeVisible();
    await expect(announcement(page)).toHaveText(
      'Item Segundo passo convertido em card filho.',
    );
    await expect(card(page, 'Segundo passo')).toContainText('Filho de Item 1');

    await page.getByRole('button', { name: 'Desfazer' }).click();
    await expect(card(page, 'Segundo passo')).toHaveCount(0);
    await expect(
      details.getByRole('checkbox', { name: 'Segundo passo' }),
    ).toBeVisible();
  });

  test('duplica o card com os filhos e abre a cópia', async ({ page }) => {
    await openBoard(page);
    const details = await openCard(page, 'Item 1');

    await details.getByRole('button', { name: 'Duplicar com filhos' }).click();

    await expect(details.getByLabel('Título')).toHaveValue('Item 1 (cópia)');
    await expect(announcement(page)).toHaveText(
      'Card Item 1 duplicado com os filhos.',
    );
    await expect(cardTitles(page, 'A fazer')).toContainText(['Item 1 (cópia)']);
    for (const child of ['Item 2', 'Item 3']) {
      await expect(
        page.getByRole('heading', { level: 3, name: child, exact: true }),
      ).toHaveCount(2);
    }
  });

  test('conta todas as descendentes no progresso do card pai', async ({
    page,
    mock,
  }) => {
    // NOTE: Item 4 passa a ser neto de Item 1 (filho de Item 2) e Item 3 fica na coluna de conclusão: 1 de 3.
    const grandchild = withCardFields({
      seed: initialBoard(),
      cardId: 'item-4',
      fields: { parentId: 'item-2' },
    });
    const finished = withCardMoved({
      seed: grandchild,
      cardId: 'item-3',
      laneId: 'done',
    });
    await mock.seedBoard(withDoneLane({ seed: finished, laneId: 'done' }));
    await openBoard(page);

    await expect(card(page, 'Item 1')).toContainText('1/3 descendentes');
    await expect(card(page, 'Item 1')).toContainText(
      '1 de 3 descendentes concluídos',
    );
    const details = await openCard(page, 'Item 1');
    await expect(
      details.getByRole('heading', {
        name: 'Cards filhos (1 de 3 descendentes concluídos)',
      }),
    ).toBeVisible();

    await closeCard(page);
    await page.getByRole('button', { name: 'Lista' }).click();
    await expect(
      page.getByRole('row').filter({ hasText: 'Item 1' }).first(),
    ).toContainText('1 de 3 descendentes concluídos');
  });
});
