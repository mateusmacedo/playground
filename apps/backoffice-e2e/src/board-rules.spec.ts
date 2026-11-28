import { expect, type Page } from '@playwright/test';

import { MAIN_BOARD_ID } from './support/board-documents';
import { cardTitles, openBoard, openCard } from './support/board-screen';
import { withCardFields, withDoneLane } from './support/board-setup';
import { startProcess } from './support/card-process-screen';
import { initialBoard } from './support/mock-samples';
import { test } from './support/mock-test';
import { EXAMPLE_PROCESS } from './support/process-documents';

const RULES = [
  'Card pai espera os filhos',
  'Card pai acompanha os filhos',
  'Conclusão espera o processo',
  'Processo concluído conclui o card',
  'Conclusão espera as dependências',
  'Card filho herda do pai',
];
const LOCKED_RULES = RULES.slice(0, 5);
const DONE_LANE = 'Concluído';

async function openSettings(page: Page) {
  await page.getByRole('button', { name: 'Configurar quadro' }).click();
  return page.getByRole('dialog', { name: 'Configurar quadro' });
}

test.describe('quadro kanban: regras do quadro', () => {
  test('trava as regras que dependem da coluna de conclusão e grava as ligadas', async ({
    page,
    mock,
  }) => {
    await openBoard(page);
    const dialog = await openSettings(page);
    const rules = dialog.getByRole('group', { name: 'Regras do quadro' });
    await expect(rules.getByRole('checkbox')).toHaveCount(RULES.length);
    for (const name of LOCKED_RULES) {
      const rule = rules.getByRole('checkbox', { name });
      await expect(rule).toBeDisabled();
      await expect(rule).toHaveAccessibleDescription(
        /Depende da coluna de conclusão: escolha uma acima para usar esta regra\.$/,
      );
    }
    await expect(
      rules.getByRole('checkbox', { name: 'Card filho herda do pai' }),
    ).toBeEnabled();

    await dialog
      .getByLabel('Coluna de conclusão')
      .selectOption({ label: DONE_LANE });
    for (const name of RULES) {
      await expect(rules.getByRole('checkbox', { name })).toBeEnabled();
    }
    await rules
      .getByRole('checkbox', { name: 'Conclusão espera o processo' })
      .check();
    await rules
      .getByRole('checkbox', { name: 'Conclusão espera as dependências' })
      .check();
    await dialog.getByRole('button', { name: 'Salvar' }).click();
    await expect(dialog).toBeHidden();

    await expect
      .poll(async () => {
        const stored = await mock.readBoard(MAIN_BOARD_ID);
        return stored?.board.config.rules;
      })
      .toMatchObject({ doneWaitsProcess: true, doneWaitsBlockers: true });
    await page.reload();
    await expect(cardTitles(page, 'A fazer').first()).toBeVisible();
    const reopened = await openSettings(page);
    await expect(
      reopened.getByRole('checkbox', { name: 'Conclusão espera o processo' }),
    ).toBeChecked();
    await expect(
      reopened.getByRole('checkbox', { name: 'Card pai espera os filhos' }),
    ).not.toBeChecked();
  });

  test('com "Conclusão espera o processo", recusa levar o card com processo em andamento à conclusão', async ({
    page,
    mock,
  }) => {
    await mock.seedBoard(
      withDoneLane({
        seed: initialBoard(),
        laneId: 'done',
        rules: ['doneWaitsProcess'],
      }),
    );
    await openBoard(page);
    await startProcess({
      page,
      cardTitle: 'Item 4',
      processName: EXAMPLE_PROCESS,
    });

    const details = page.getByRole('dialog', { name: 'Detalhes do card' });
    await details.getByLabel('Coluna').selectOption({ label: DONE_LANE });

    await expect(
      page.getByRole('alert').filter({
        hasText: `O card Item 4 tem o processo ${EXAMPLE_PROCESS} em andamento: conclua ou cancele o processo antes de levar o card para ${DONE_LANE}.`,
      }),
    ).toBeVisible();
    await expect(cardTitles(page, 'Em andamento')).toHaveText(['Item 4']);
    await expect(cardTitles(page, DONE_LANE)).toHaveCount(0);
  });

  test('com "Conclusão espera as dependências", recusa levar o card bloqueado à conclusão', async ({
    page,
    mock,
  }) => {
    const blocked = withCardFields({
      seed: initialBoard(),
      cardId: 'item-4',
      fields: { blockedBy: ['item-3'] },
    });
    await mock.seedBoard(
      withDoneLane({
        seed: blocked,
        laneId: 'done',
        rules: ['doneWaitsBlockers'],
      }),
    );
    await openBoard(page);
    const details = await openCard(page, 'Item 4');

    await details.getByLabel('Coluna').selectOption({ label: DONE_LANE });

    await expect(
      page.getByRole('alert').filter({
        hasText: `O card Item 4 está bloqueado por Item 3: conclua o que o bloqueia antes de levar o card para ${DONE_LANE}.`,
      }),
    ).toBeVisible();
    await expect(cardTitles(page, 'Em andamento')).toHaveText(['Item 4']);
  });
});
