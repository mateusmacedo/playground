import { expect, type Locator, type Page } from '@playwright/test';
import { closeCard, openBoard, openCard } from './support/board-screen';
import { withDoneLane } from './support/board-setup';
import {
  activeStep,
  processSection,
  startProcess,
  trailSummary,
} from './support/card-process-screen';
import { initialBoard } from './support/mock-samples';
import { test } from './support/mock-test';
import {
  EXAMPLE_PROCESS,
  PURCHASE_PROCESS,
  purchaseDefinition,
} from './support/process-documents';

const PARENT = 'Item 4';
const PARENT_LANE = 'Em andamento';
const DONE_LANE = 'Concluído';

interface DelegateParams {
  readonly page: Page;
  readonly section: Locator;
  readonly stepName: string;
}

/** Cria o card filho da etapa, abre o filho pelo link da etapa e o leva à coluna de conclusão. */
async function delegateAndFinish({ page, section, stepName }: DelegateParams) {
  const step = activeStep(section, stepName);
  await step
    .getByRole('button', { name: 'Criar card filho para esta etapa' })
    .click();
  await expect(step).toContainText(
    `Card filho desta etapa: ${stepName} (${PARENT_LANE})`,
  );

  await step.getByRole('button', { name: stepName, exact: true }).click();
  const details = page.getByRole('dialog', { name: 'Detalhes do card' });
  await expect(details.getByLabel('Título')).toHaveValue(stepName);
  await details.getByLabel('Coluna').selectOption({ label: DONE_LANE });

  await closeCard(page);
  return processSection(await openCard(page, PARENT));
}

test.describe('quadro kanban: card filho de etapa do processo', () => {
  test.beforeEach(async ({ mock }) => {
    await mock.seedBoard(
      withDoneLane({ seed: initialBoard(), laneId: 'done' }),
    );
  });

  test('o filho levado à coluna de conclusão conclui a etapa do pai', async ({
    page,
  }) => {
    await openBoard(page);
    const section = await startProcess({
      page,
      cardTitle: PARENT,
      processName: EXAMPLE_PROCESS,
    });

    const parentSection = await delegateAndFinish({
      page,
      section,
      stepName: 'Primeira etapa',
    });

    await expect(
      parentSection.getByText('Concluído', { exact: true }),
    ).toBeVisible();
    await expect(trailSummary(parentSection)).toBeVisible();
    await expect(parentSection).toContainText(
      'Etapa Primeira etapa entregue a um card filho.',
    );
    await expect(parentSection).toContainText(
      'Concluída pelo card filho Primeira etapa.',
    );
  });

  test('a etapa com campo obrigatório continua aberta, com a explicação, depois do filho concluído', async ({
    page,
    mock,
  }) => {
    await mock.seedDefinition(purchaseDefinition());
    await openBoard(page);
    const section = await startProcess({
      page,
      cardTitle: PARENT,
      processName: PURCHASE_PROCESS,
    });

    const parentSection = await delegateAndFinish({
      page,
      section,
      stepName: 'Preencher o pedido',
    });

    const step = activeStep(parentSection, 'Preencher o pedido');
    await expect(step).toContainText(
      `Card filho desta etapa: Preencher o pedido (${DONE_LANE})`,
    );
    await expect(step).toContainText(
      'O card filho já foi concluído. A etapa continua aberta porque pede campo obrigatório ou uma escolha: resolva-a aqui.',
    );
    await expect(
      step.getByRole('button', { name: 'Concluir etapa' }),
    ).toBeVisible();
  });
});
