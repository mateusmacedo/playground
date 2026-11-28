import { expect, type Page } from '@playwright/test';
import { openBoard } from './support/board-screen';
import { savedProcessStatus } from './support/board-setup';
import { activeStep, startProcess } from './support/card-process-screen';
import { test } from './support/mock-test';
import {
  PURCHASE_PROCESS,
  purchaseDefinition,
} from './support/process-documents';
import { completePurchaseRequest } from './support/purchase-flow';
import { menuLink, openByMenu, sideMenu } from './support/side-menu';

const CARD = 'Item 4';
const CARD_ID = 'item-4';
const CARD_LINK = 'QD-4 Item 4';
const RUNS_COLUMNS = [
  'Processo',
  'Card',
  'Quadro',
  'Etapa atual',
  'Progresso',
  'Início',
  'Diagrama',
];

function runsTable(page: Page) {
  return page.getByRole('table', { name: 'Execuções em andamento' });
}

function diagram(page: Page) {
  return page.getByLabel('Diagrama da execução');
}

/** Espera o diagrama marcar o bloco como a etapa atual. */
async function expectCurrentStep(page: Page, step: string) {
  await expect(
    diagram(page).getByLabel(new RegExp(`${step}.*, etapa atual$`)),
  ).toBeVisible();
}

test.describe('processos: diagrama da execução do card', () => {
  test.beforeEach(async ({ mock }) => {
    await mock.seedDefinition(purchaseDefinition());
  });

  test('"Ver diagrama" espera a gravação, mostra a etapa atual e volta ao card', async ({
    page,
    mockScenario,
  }) => {
    await openBoard(page);
    const section = await startProcess({
      page,
      cardTitle: CARD,
      processName: PURCHASE_PROCESS,
    });
    await completePurchaseRequest(section);
    await mockScenario.start('slow');

    const link = section.getByRole('link', { name: 'Ver diagrama' });
    await link.click();
    await expect(
      section.getByRole('status').filter({
        hasText: 'Gravando o quadro antes de abrir…',
      }),
    ).toBeVisible();
    await expect(link).toHaveAttribute('aria-disabled', 'true');

    await expect(page).toHaveURL(
      /\/processos\/execucao\?ref=board-1(:|%3A)item-4$/,
    );
    await mockScenario.stop();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Execução do processo' }),
    ).toBeVisible();
    await expectCurrentStep(page, 'Aprovar a compra');

    await page.getByRole('link', { name: 'Voltar ao card' }).click();
    const details = page.getByRole('dialog', { name: 'Detalhes do card' });
    await expect(details.getByLabel('Título')).toHaveValue(CARD);
    await expect(
      activeStep(
        details.getByRole('region', { name: 'Processo' }),
        'Aprovar a compra',
      ),
    ).toBeVisible();
  });

  test('com a gravação falhando, "Ver diagrama" fica no quadro e explica o motivo', async ({
    page,
    mockScenario,
  }) => {
    await openBoard(page);
    const section = await startProcess({
      page,
      cardTitle: CARD,
      processName: PURCHASE_PROCESS,
    });
    await mockScenario.start('unavailable');
    await completePurchaseRequest(section);

    await section.getByRole('link', { name: 'Ver diagrama' }).click();

    await expect(
      section.getByRole('alert').filter({
        hasText:
          'O diagrama não abriu porque o quadro ainda não foi gravado no servidor. O aviso acima do quadro diz o motivo.',
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('alert').filter({
        hasText: 'As últimas mudanças ainda não foram gravadas no servidor',
      }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/quadro/);
  });

  test('a lista de execuções aberta pelo menu leva ao diagrama e ao card de cada linha', async ({
    page,
    mock,
  }) => {
    await openBoard(page);
    await startProcess({
      page,
      cardTitle: CARD,
      processName: PURCHASE_PROCESS,
    });
    await expect
      .poll(() => savedProcessStatus({ mock, cardId: CARD_ID }))
      .toBe('running');

    await openByMenu({ page, group: 'Processos', item: 'Execuções' });
    await expect(
      page.getByRole('heading', { level: 1, name: 'Execuções' }),
    ).toBeVisible();
    const table = runsTable(page);
    await expect(table.getByRole('columnheader')).toHaveText(RUNS_COLUMNS);
    const row = table.getByRole('row').filter({ hasText: CARD_LINK });
    await expect(row.getByRole('rowheader')).toHaveText(
      `${PURCHASE_PROCESS} Versão 1`,
    );
    await expect(row).toContainText('Quadro principal');
    await expect(
      row.getByRole('listitem').filter({ hasText: 'Preencher o pedido' }),
    ).toBeVisible();
    await expect(row).toContainText(/0 de \d+ etapas/);

    await row
      .getByRole('link', { name: `Ver diagrama de ${CARD_LINK}` })
      .click();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Execução do processo' }),
    ).toBeVisible();
    await expectCurrentStep(page, 'Preencher o pedido');
    await expect(menuLink(page, 'Execuções')).toHaveAttribute(
      'aria-current',
      'page',
    );

    await page.getByRole('link', { name: 'Todas as execuções' }).click();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Execuções' }),
    ).toBeFocused();
    const card = runsTable(page).getByRole('link', {
      name: CARD_LINK,
      exact: true,
    });
    await expect(card).toHaveAttribute(
      'href',
      '/quadro?quadro=board-1&card=QD-4',
    );
    await card.click();
    await expect(
      page
        .getByRole('dialog', { name: 'Detalhes do card' })
        .getByLabel('Título'),
    ).toHaveValue(CARD);
  });
});

test.describe('processos: lista de execuções', () => {
  test('sem processo em andamento, orienta a começar pelo quadro', async ({
    page,
  }) => {
    await page.goto('/');
    await openByMenu({ page, group: 'Processos', item: 'Execuções' });

    await expect(
      page.getByText('Nenhuma execução em andamento.'),
    ).toBeVisible();
    await expect(
      page.getByText(
        'Para começar uma, abra um card do quadro e inicie um processo nele.',
      ),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Ir para o quadro' }),
    ).toHaveAttribute('href', '/quadro');
    await expect(runsTable(page)).toHaveCount(0);
    await expect(
      sideMenu(page).getByRole('link', { name: 'Execuções' }),
    ).toHaveAttribute('aria-current', 'page');
  });

  test('avisa a falha da leitura e mostra a lista com "Tentar de novo"', async ({
    page,
    mockScenario,
  }) => {
    await mockScenario.start('error');
    await page.goto('/processos/execucao');
    const failure = page
      .getByRole('alert')
      .filter({ hasText: 'Não foi possível carregar as execuções.' });
    await expect(failure).toContainText(
      'O servidor encontrou um problema. Tente de novo em instantes.',
    );

    await mockScenario.stop();
    await failure.getByRole('button', { name: 'Tentar de novo' }).click();

    await expect(failure).toHaveCount(0);
    await expect(
      page.getByText('Nenhuma execução em andamento.'),
    ).toBeVisible();
  });
});
