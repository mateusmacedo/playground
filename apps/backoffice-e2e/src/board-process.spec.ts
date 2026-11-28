import { expect } from '@playwright/test';

import {
  announcement,
  card,
  closeCard,
  openBoard,
  openCard,
} from './support/board-screen';
import {
  activeStep,
  chooseProcess,
  processSection,
  startProcess,
} from './support/card-process-screen';
import { test } from './support/mock-test';
import {
  EXAMPLE_PROCESS,
  PURCHASE_PROCESS,
  purchaseDefinition,
  unpublishedInitialDefinition,
} from './support/process-documents';

const CARD = 'Item 4';
const NO_PROCESS = 'Este card não segue nenhum processo.';

test.describe('quadro kanban: processo no card', () => {
  test('escolhe o processo no catálogo e o inicia pelo painel do card', async ({
    page,
    mock,
  }) => {
    await mock.seedDefinition(purchaseDefinition());
    await openBoard(page);
    const details = await openCard(page, CARD);
    const section = processSection(details);
    await expect(section).toContainText(NO_PROCESS);

    const open = section.getByRole('button', { name: 'Escolher processo' });
    await open.click();
    await expect(open).toHaveAttribute('aria-expanded', 'true');
    const picker = section.getByLabel('Processo', { exact: true });
    await expect(picker.getByRole('option')).toHaveText([
      `${EXAMPLE_PROCESS} (versão 1)`,
      `${PURCHASE_PROCESS} (versão 1)`,
    ]);
    await picker.selectOption({ label: `${PURCHASE_PROCESS} (versão 1)` });
    await section.getByRole('button', { name: 'Iniciar processo' }).click();

    await expect(announcement(page)).toHaveText(
      `Processo ${PURCHASE_PROCESS} iniciado no card ${CARD}.`,
    );
    await expect(
      section.getByRole('heading', { name: 'Processo' }),
    ).toBeFocused();
    await expect(section).toContainText('versão 1');
    await expect(
      section.getByText('Em andamento', { exact: true }),
    ).toBeVisible();
    await expect(activeStep(section, 'Preencher o pedido')).toBeVisible();
  });

  test('mostra o selo do processo no card e na lista', async ({
    page,
    mock,
  }) => {
    await mock.seedDefinition(purchaseDefinition());
    await openBoard(page);
    await startProcess({
      page,
      cardTitle: CARD,
      processName: PURCHASE_PROCESS,
    });
    await closeCard(page);

    await expect(card(page, CARD)).toContainText(
      new RegExp(`Processo ${PURCHASE_PROCESS}: 0 de \\d+ etapas feitas`),
    );
    await expect(card(page, CARD)).toContainText(
      new RegExp(`${PURCHASE_PROCESS} 0/\\d+`),
    );

    await page.getByRole('button', { name: 'Lista' }).click();
    const table = page.getByRole('table', {
      name: 'Cards do quadro, um por linha',
    });
    await expect(
      table.getByRole('columnheader', { name: 'Processo' }),
    ).toBeVisible();
    await expect(
      table.getByRole('row').filter({ hasText: CARD }),
    ).toContainText(PURCHASE_PROCESS);
    await expect(
      table.getByRole('row').filter({ hasText: 'Item 3' }),
    ).toContainText('—');
  });

  test('cancela o processo depois da confirmação, e desistir mantém o processo', async ({
    page,
  }) => {
    await openBoard(page);
    const section = await startProcess({
      page,
      cardTitle: CARD,
      processName: EXAMPLE_PROCESS,
    });
    const cancel = section.getByRole('button', { name: 'Cancelar processo' });

    await cancel.click();
    const confirm = page.getByRole('dialog', {
      name: `Cancelar o processo ${EXAMPLE_PROCESS}`,
    });
    await confirm.getByRole('button', { name: 'Manter o processo' }).click();
    await expect(confirm).toBeHidden();
    await expect(cancel).toBeFocused();
    await expect(activeStep(section, 'Primeira etapa')).toBeVisible();

    await cancel.click();
    await confirm.getByRole('button', { name: 'Cancelar processo' }).click();
    await expect(section.getByText('Cancelado', { exact: true })).toBeVisible();
    await expect(section).toContainText(
      'Processo cancelado. Etapas pendentes: Primeira etapa.',
    );
    await expect(card(page, CARD)).toContainText(
      `Processo ${EXAMPLE_PROCESS}: cancelado`,
    );
  });

  test('inicia outro processo depois do fim e remove o processo encerrado', async ({
    page,
    mock,
  }) => {
    await mock.seedDefinition(purchaseDefinition());
    await openBoard(page);
    const section = await startProcess({
      page,
      cardTitle: CARD,
      processName: EXAMPLE_PROCESS,
    });
    await activeStep(section, 'Primeira etapa')
      .getByRole('button', { name: 'Concluir etapa' })
      .click();
    await expect(section.getByText('Concluído', { exact: true })).toBeVisible();

    await chooseProcess({
      section,
      processName: PURCHASE_PROCESS,
      openLabel: 'Iniciar outro processo',
    });
    await expect(section).toContainText(PURCHASE_PROCESS);
    await expect(activeStep(section, 'Preencher o pedido')).toBeVisible();

    await section.getByRole('button', { name: 'Cancelar processo' }).click();
    await page
      .getByRole('dialog', { name: `Cancelar o processo ${PURCHASE_PROCESS}` })
      .getByRole('button', { name: 'Cancelar processo' })
      .click();
    await section.getByRole('button', { name: 'Remover processo' }).click();

    await expect(section).toContainText(NO_PROCESS);
    await expect(announcement(page)).toHaveText(
      `Processo ${PURCHASE_PROCESS} removido do card.`,
    );
    await expect(card(page, CARD)).not.toContainText(PURCHASE_PROCESS);
  });

  test('sem processo publicado, leva ao editor de processos', async ({
    page,
    mock,
  }) => {
    await mock.seedDefinition(unpublishedInitialDefinition());
    await openBoard(page);
    const section = processSection(await openCard(page, CARD));

    await section.getByRole('button', { name: 'Escolher processo' }).click();

    await expect(section).toContainText(
      'Nenhum processo publicado ainda. Desenhe e publique um processo para os cards poderem segui-lo.',
    );
    await expect(
      section.getByRole('link', { name: 'Abrir o editor de processos' }),
    ).toHaveAttribute('href', '/processos');
    await expect(
      section.getByRole('button', { name: 'Iniciar processo' }),
    ).toHaveCount(0);
  });
});
