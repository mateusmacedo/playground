import { expect, type Locator } from '@playwright/test';

import { activeStep } from './card-process-screen';

/** O que o teste preenche na etapa "Preencher o pedido" e como a trilha mostra cada valor. */
export const PURCHASE_REQUEST = {
  item: 'Notebook',
  amount: '2500',
  wanted: '2026-12-01',
  wantedText: '01/12/2026',
  origin: 'Site',
} as const;

/** Preenche os campos da etapa "Preencher o pedido", os obrigatórios e os opcionais, sem concluir. */
export async function fillPurchaseRequest(step: Locator) {
  await step.getByLabel('Item', { exact: true }).fill(PURCHASE_REQUEST.item);
  await step.getByLabel('Valor', { exact: true }).fill(PURCHASE_REQUEST.amount);
  await step
    .getByLabel('Data desejada', { exact: true })
    .fill(PURCHASE_REQUEST.wanted);
  await step
    .getByLabel('Origem', { exact: true })
    .selectOption(PURCHASE_REQUEST.origin);
  await step.getByLabel('Urgente', { exact: true }).check();
}

/** Preenche e conclui "Preencher o pedido", e espera a aprovação. */
export async function completePurchaseRequest(section: Locator) {
  const request = activeStep(section, 'Preencher o pedido');
  await fillPurchaseRequest(request);
  await request.getByRole('button', { name: 'Concluir etapa' }).click();
  await expect(activeStep(section, 'Aprovar a compra')).toBeVisible();
}

/** Dá o parecer e aprova a compra, e espera a decisão "Valor alto?". */
export async function approvePurchase(section: Locator) {
  const approval = activeStep(section, 'Aprovar a compra');
  await approval
    .getByLabel('Parecer', { exact: true })
    .fill('Cabe no orçamento.');
  await approval.getByRole('button', { name: 'Aprovar' }).click();
  await expect(activeStep(section, 'Valor alto?')).toBeVisible();
}
