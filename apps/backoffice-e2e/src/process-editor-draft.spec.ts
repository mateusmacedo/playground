import { expect, type Locator, type Page } from '@playwright/test';

import {
  savedDraftText,
  withRenamedBlock,
} from './support/definition-documents';
import { initialDefinition } from './support/mock-samples';
import { test } from './support/mock-test';
import {
  canvas,
  draftStatus,
  nodes,
  openEditor,
} from './support/process-editor-screen';

test.use({ viewport: { width: 1600, height: 1000 } });

const SAVED_ON_SERVER = 'Rascunho salvo no servidor.';
const THEIR_BLOCK = 'Etapa de outra pessoa';

function block(page: Page, label: string): Locator {
  return canvas(page).getByText(label, { exact: true });
}

function notice(page: Page, text: string): Locator {
  return page.getByRole('alert').filter({ hasText: text });
}

/** O aviso de que o processo mudou em outro lugar, com as duas saídas. */
function conflictNotice(page: Page): Locator {
  return notice(page, 'A sua edição continua nesta tela.');
}

test.describe('editor de processos: rascunho', () => {
  test('salva fluxo incompleto, tenta de novo após falha e reabre igual', async ({
    page,
    mock,
    mockScenario,
  }) => {
    await openEditor(page);
    await expect(draftStatus(page)).toHaveText(SAVED_ON_SERVER);

    await page.getByRole('button', { name: 'Inserir Temporizador' }).click();
    await expect(draftStatus(page)).toHaveText('Alterações não salvas.');
    await mockScenario.start('error');
    await page.getByRole('button', { name: 'Salvar rascunho' }).click();
    await expect(draftStatus(page)).toHaveText(
      'Falha ao salvar o rascunho. A edição continua aqui.',
    );
    await expect(block(page, 'Temporizador')).toBeVisible();

    await mockScenario.stop();
    await page.getByRole('button', { name: 'Tentar novamente' }).click();
    await expect(draftStatus(page)).toHaveText(SAVED_ON_SERVER);
    await expect.poll(() => savedDraftText({ mock })).toContain('Temporizador');

    await page.reload();
    await expect(block(page, 'Temporizador')).toBeVisible();
    await expect(nodes(page)).toHaveCount(4);
    await expect(draftStatus(page)).toHaveText(SAVED_ON_SERVER);
  });
});

test.describe('editor de processos: leitura pela API', () => {
  test('avisa a falha da leitura e abre o editor com Tentar de novo', async ({
    page,
    mockScenario,
  }) => {
    await mockScenario.start('error');
    await page.goto('/processos');
    const failure = notice(page, 'Não foi possível carregar os processos.');
    await expect(failure).toContainText(
      'O servidor encontrou um problema. Tente de novo em instantes.',
    );

    await mockScenario.stop();
    await failure.getByRole('button', { name: 'Tentar de novo' }).click();

    await expect(block(page, 'Primeira etapa')).toBeVisible();
    await expect(failure).toHaveCount(0);
    await expect(draftStatus(page)).toHaveText(SAVED_ON_SERVER);
  });
});

test.describe('editor de processos: conflito ao salvar o rascunho', () => {
  // NOTE: semear com a tela aberta é a gravação de outra pessoa: o servidor passa a uma revisão que a página não leu, e
  // o salvamento dela é recusado.
  test.beforeEach(async ({ page, mock }) => {
    await openEditor(page);
    await mock.seedDefinition(
      withRenamedBlock({
        seed: initialDefinition(),
        from: 'Primeira etapa',
        to: THEIR_BLOCK,
      }),
    );
    await page.getByRole('button', { name: 'Inserir Temporizador' }).click();
    await page.getByRole('button', { name: 'Salvar rascunho' }).click();
    await expect(conflictNotice(page)).toBeVisible();
    await expect(block(page, 'Temporizador')).toBeVisible();
  });

  test('Recarregar do servidor reabre o processo de lá e descarta a edição', async ({
    page,
    mock,
  }) => {
    await conflictNotice(page)
      .getByRole('button', { name: 'Recarregar do servidor' })
      .click();

    await expect(block(page, THEIR_BLOCK)).toBeVisible();
    await expect(block(page, 'Temporizador')).toHaveCount(0);
    await expect(conflictNotice(page)).toHaveCount(0);
    await expect(draftStatus(page)).toHaveText(SAVED_ON_SERVER);
    expect(await savedDraftText({ mock })).not.toContain('Temporizador');
  });

  test('Manter a minha versão grava o rascunho desta tela por cima', async ({
    page,
    mock,
  }) => {
    await conflictNotice(page)
      .getByRole('button', { name: 'Manter a minha versão' })
      .click();

    await expect(conflictNotice(page)).toHaveCount(0);
    await expect(draftStatus(page)).toHaveText(SAVED_ON_SERVER);
    await expect(block(page, 'Temporizador')).toBeVisible();
    await expect.poll(() => savedDraftText({ mock })).toContain('Temporizador');
    expect(await savedDraftText({ mock })).not.toContain(THEIR_BLOCK);
  });
});
