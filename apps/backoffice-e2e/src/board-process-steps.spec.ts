import { expect } from '@playwright/test';

import { openBoard } from './support/board-screen';
import {
  activeStep,
  startProcess,
  trailSummary,
} from './support/card-process-screen';
import { test } from './support/mock-test';
import {
  PURCHASE_PROCESS,
  purchaseDefinition,
} from './support/process-documents';
import {
  approvePurchase,
  completePurchaseRequest,
  fillPurchaseRequest,
  PURCHASE_REQUEST,
} from './support/purchase-flow';

const CARD = 'Item 4';

test.describe('quadro kanban: etapas do processo no card', () => {
  test.beforeEach(async ({ mock, page }) => {
    await mock.seedDefinition(purchaseDefinition());
    await openBoard(page);
  });

  test('recusa a etapa sem os campos obrigatórios e a conclui com eles preenchidos', async ({
    page,
  }) => {
    const section = await startProcess({
      page,
      cardTitle: CARD,
      processName: PURCHASE_PROCESS,
    });
    const request = activeStep(section, 'Preencher o pedido');
    await expect(request).toContainText('Tarefa humana · Papel: Solicitante');
    await expect(
      section.getByRole('progressbar', { name: 'Andamento do processo' }),
    ).toBeVisible();

    await request.getByRole('button', { name: 'Concluir etapa' }).click();
    await expect(request.getByRole('alert')).toHaveText(
      'Preencha os campos obrigatórios: Item, Valor, Origem.',
    );

    await fillPurchaseRequest(request);
    await request.getByRole('button', { name: 'Concluir etapa' }).click();

    await expect(request).toHaveCount(0);
    await expect(activeStep(section, 'Aprovar a compra')).toContainText(
      'Aprovação · Papel: Diretoria',
    );
    await expect(section).toContainText(/1 de \d+ etapas feitas/);
  });

  test('recusa a rejeição sem motivo e aprova com o parecer', async ({
    page,
  }) => {
    const section = await startProcess({
      page,
      cardTitle: CARD,
      processName: PURCHASE_PROCESS,
    });
    await completePurchaseRequest(section);
    const approval = activeStep(section, 'Aprovar a compra');
    await expect(approval).toContainText('Obrigatória para rejeitar.');

    await approval.getByRole('button', { name: 'Rejeitar' }).click();
    await expect(approval.getByRole('alert')).toHaveText(
      'Informe o motivo da rejeição.',
    );

    await approvePurchase(section);
    await expect(activeStep(section, 'Valor alto?')).toContainText(
      'Decisão exclusiva',
    );
  });

  test('segue pela decisão, espera os caminhos em paralelo, passa pelo subprocesso e termina com o desfecho', async ({
    page,
  }) => {
    const section = await startProcess({
      page,
      cardTitle: CARD,
      processName: PURCHASE_PROCESS,
    });
    await completePurchaseRequest(section);
    await approvePurchase(section);

    await activeStep(section, 'Valor alto?')
      .getByRole('button', { name: 'Seguir por Sim' })
      .click();
    const quotes = activeStep(section, 'Pedir cotações');
    const budget = activeStep(section, 'Reservar o orçamento');
    await expect(quotes).toBeVisible();
    await expect(budget).toBeVisible();

    await quotes.getByRole('button', { name: 'Concluir etapa' }).click();
    await expect(activeStep(section, 'Juntar')).toContainText(
      'Aguardando os outros caminhos.',
    );
    await expect(activeStep(section, 'Juntar').getByRole('button')).toHaveCount(
      0,
    );

    await budget.getByRole('button', { name: 'Concluir etapa' }).click();
    await expect(activeStep(section, 'Pagamento')).toContainText(
      'Subprocesso em andamento: as etapas dele aparecem nesta lista.',
    );
    const check = activeStep(section, 'Conferir os dados');
    await expect(check).toContainText('Em Pagamento');

    await check.getByRole('button', { name: 'Concluir etapa' }).click();
    await expect(section.getByText('Concluído', { exact: true })).toBeVisible();
    await expect(section).toContainText('Desfecho: Concluído');
    await expect(section).toContainText('Encerrado em');
    await expect(
      section.getByRole('list', { name: 'Etapas em andamento' }),
    ).toHaveCount(0);
  });

  test('registra na trilha cada passo, com o autor e os valores dos campos', async ({
    page,
  }) => {
    const section = await startProcess({
      page,
      cardTitle: CARD,
      processName: PURCHASE_PROCESS,
    });
    await completePurchaseRequest(section);

    const summary = trailSummary(section);
    await expect(summary).toHaveText('Trilha da execução (2 registros)');
    await summary.click();
    const trail = section
      .getByRole('group')
      .filter({ hasText: /^Trilha da execução/ });
    await expect(trail).toContainText(`Processo ${PURCHASE_PROCESS} iniciado.`);
    await expect(trail).toContainText('Etapa Preencher o pedido concluída.');
    await expect(trail).toContainText('por Usuário');
    for (const [label, value] of [
      ['Item', PURCHASE_REQUEST.item],
      ['Valor', PURCHASE_REQUEST.amount],
      ['Data desejada', PURCHASE_REQUEST.wantedText],
      ['Origem', PURCHASE_REQUEST.origin],
      ['Urgente', 'Sim'],
    ]) {
      await expect(
        trail.getByRole('term').filter({ hasText: label }),
      ).toHaveCount(1);
      await expect(
        trail.getByRole('definition').filter({ hasText: value }),
      ).toHaveCount(1);
    }
  });
});
