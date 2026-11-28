import { expect, type Page } from '@playwright/test';

import { MAIN_PROCESS_ID } from './support/definition-documents';
import type { MockServer } from './support/mock-server';
import { test } from './support/mock-test';
import { EXAMPLE_PROCESS } from './support/process-documents';
import {
  copyOfInitialDefinition,
  draftNodeCount,
} from './support/process-drafts';
import {
  canvas,
  draftStatus,
  nodes,
  openEditor,
} from './support/process-editor-screen';
import {
  chooseProcessAction,
  dialog,
  fillProcessName,
  processSelect,
  SAVED_ON_SERVER,
} from './support/process-workspace-screen';

test.use({ viewport: { width: 1600, height: 1000 } });

const OTHER_PROCESS = 'Atendimento ao cliente';
const OTHER_PROCESS_ID = 'process-2';
const OTHER_STEP = 'Registrar chamado';
const INITIAL_NODES = 3;

/** Semeia um segundo processo, para o seletor ter para onde trocar. */
async function seedOtherProcess(mock: MockServer) {
  await mock.seedDefinition(
    copyOfInitialDefinition({
      id: OTHER_PROCESS_ID,
      name: OTHER_PROCESS,
      stepTitle: OTHER_STEP,
    }),
  );
}

/** O id do processo aberto, lido do endereço (`?processo=<id>`). */
function openProcessId(page: Page): string {
  const id = new URL(page.url()).searchParams.get('processo');
  if (id === null) {
    throw new Error('O endereço do editor não diz qual processo está aberto.');
  }
  return id;
}

async function savedDefinition(mock: MockServer, id: string) {
  const stored = await mock.readDefinition(id);
  return stored?.definition;
}

test.describe('editor de processos: catálogo', () => {
  test('cria um processo novo, renomeia e descreve', async ({ page, mock }) => {
    await openEditor(page);

    await page.getByRole('button', { name: 'Novo processo' }).click();
    await fillProcessName({
      page,
      title: 'Novo processo',
      name: 'Compras',
      confirm: 'Criar processo',
    });
    await expect(
      processSelect(page).getByRole('option', {
        name: 'Compras',
        exact: true,
        selected: true,
      }),
    ).toHaveCount(1);
    await expect(page.getByText('Rascunho', { exact: true })).toBeVisible();
    await expect(page).not.toHaveURL(new RegExp(`processo=${MAIN_PROCESS_ID}`));
    const createdId = openProcessId(page);
    await expect
      .poll(async () => (await savedDefinition(mock, createdId))?.name)
      .toBe('Compras');

    await chooseProcessAction(page, 'Renomear processo');
    await fillProcessName({
      page,
      title: 'Renomear processo',
      name: 'Compras do escritório',
      confirm: 'Renomear',
    });
    await chooseProcessAction(page, 'Editar descrição');
    const describe = dialog(page, 'Editar descrição');
    await describe
      .getByLabel('Descrição do processo')
      .fill('Pedidos de material de escritório.');
    await describe.getByRole('button', { name: 'Salvar descrição' }).click();

    await expect(
      processSelect(page).getByRole('option', {
        name: 'Compras do escritório',
        selected: true,
      }),
    ).toHaveCount(1);
    await expect(
      page.getByText('Pedidos de material de escritório.'),
    ).toBeVisible();
    await expect
      .poll(async () => {
        const saved = await savedDefinition(mock, createdId);
        return [saved?.name, saved?.description];
      })
      .toEqual(['Compras do escritório', 'Pedidos de material de escritório.']);
  });

  test('recusa o nome vazio e o nome de outro processo', async ({ page }) => {
    await openEditor(page);

    await page.getByRole('button', { name: 'Novo processo' }).click();
    const window = dialog(page, 'Novo processo');
    const name = window.getByLabel('Nome do processo');
    await name.fill(EXAMPLE_PROCESS.toUpperCase());

    await expect(name).toHaveAccessibleDescription(
      'Já existe um processo com este nome.',
    );
    await expect(
      window.getByRole('button', { name: 'Criar processo' }),
    ).toBeDisabled();
    await name.fill('');
    await expect(name).toHaveAccessibleDescription(
      'Informe o nome do processo.',
    );
    await expect(
      window.getByRole('button', { name: 'Criar processo' }),
    ).toBeDisabled();
  });

  test('troca de processo pelo seletor e pede confirmação com alteração não salva', async ({
    page,
    mock,
  }) => {
    await seedOtherProcess(mock);
    await openEditor(page);
    await page.getByRole('button', { name: 'Inserir Etapa' }).click();
    await expect(nodes(page)).toHaveCount(INITIAL_NODES + 1);

    await processSelect(page).selectOption({ label: OTHER_PROCESS });
    const confirm = dialog(page, 'Alterações não salvas');
    await expect(confirm).toContainText(EXAMPLE_PROCESS);
    await confirm.getByRole('button', { name: 'Cancelar' }).click();
    await expect(confirm).toBeHidden();
    await expect(processSelect(page)).toHaveValue(MAIN_PROCESS_ID);
    await expect(nodes(page)).toHaveCount(INITIAL_NODES + 1);

    await processSelect(page).selectOption({ label: OTHER_PROCESS });
    await confirm.getByRole('button', { name: 'Trocar sem salvar' }).click();
    await expect(canvas(page).getByText(OTHER_STEP)).toBeVisible();
    await expect(page).toHaveURL(/processo=process-2/);
    await expect(processSelect(page)).toHaveValue(OTHER_PROCESS_ID);

    await processSelect(page).selectOption({ label: EXAMPLE_PROCESS });
    await expect(canvas(page).getByText('Primeira etapa')).toBeVisible();
    await expect(nodes(page)).toHaveCount(INITIAL_NODES);
    const saved = await savedDefinition(mock, MAIN_PROCESS_ID);
    expect(draftNodeCount(saved?.draftText ?? '')).toBe(INITIAL_NODES);
  });

  test('salva o rascunho antes de trocar quando a pessoa escolhe "Salvar e trocar"', async ({
    page,
    mock,
  }) => {
    await seedOtherProcess(mock);
    await openEditor(page);
    await page.getByRole('button', { name: 'Inserir Etapa' }).click();

    await processSelect(page).selectOption({ label: OTHER_PROCESS });
    await dialog(page, 'Alterações não salvas')
      .getByRole('button', { name: 'Salvar e trocar' })
      .click();

    await expect(canvas(page).getByText(OTHER_STEP)).toBeVisible();
    const saved = await savedDefinition(mock, MAIN_PROCESS_ID);
    expect(draftNodeCount(saved?.draftText ?? '')).toBe(INITIAL_NODES + 1);

    await processSelect(page).selectOption({ label: EXAMPLE_PROCESS });
    await expect(nodes(page)).toHaveCount(INITIAL_NODES + 1);
    await expect(draftStatus(page)).toHaveText(SAVED_ON_SERVER);
  });

  test('arquiva o processo aberto e o restaura pelos arquivados', async ({
    page,
    mock,
  }) => {
    await seedOtherProcess(mock);
    await openEditor(page);

    await chooseProcessAction(page, 'Arquivar processo');
    const archive = dialog(page, 'Arquivar processo');
    await expect(archive).toContainText(EXAMPLE_PROCESS);
    await archive.getByRole('button', { name: 'Arquivar' }).click();

    await expect(canvas(page).getByText(OTHER_STEP)).toBeVisible();
    await expect(processSelect(page)).toHaveValue(OTHER_PROCESS_ID);
    await expect(
      processSelect(page).getByRole('option', { name: EXAMPLE_PROCESS }),
    ).toHaveCount(0);
    await expect
      .poll(
        async () => (await savedDefinition(mock, MAIN_PROCESS_ID))?.archived,
      )
      .toBe(true);

    await chooseProcessAction(page, 'Arquivados (1)');
    const archived = dialog(page, 'Processos arquivados');
    await archived
      .getByRole('button', { name: `Restaurar ${EXAMPLE_PROCESS}` })
      .click();
    await expect(archived).toContainText('Nenhum processo arquivado.');
    await archived.getByRole('button', { name: 'Fechar' }).click();

    await expect(
      processSelect(page).getByRole('option', { name: EXAMPLE_PROCESS }),
    ).toHaveCount(1);
    await expect
      .poll(
        async () => (await savedDefinition(mock, MAIN_PROCESS_ID))?.archived,
      )
      .not.toBe(true);
  });

  test('não deixa arquivar o único processo ativo', async ({ page }) => {
    await openEditor(page);

    await page.getByRole('button', { name: /^Ações do processo / }).click();

    await expect(
      page.getByRole('menu').getByRole('button', { name: 'Arquivar processo' }),
    ).toBeDisabled();
  });

  test('abre o processo pedido no endereço', async ({ page, mock }) => {
    await seedOtherProcess(mock);

    await openEditor(page, {
      address: `/processos?processo=${OTHER_PROCESS_ID}`,
      block: OTHER_STEP,
    });

    await expect(processSelect(page)).toHaveValue(OTHER_PROCESS_ID);
    await expect(canvas(page).getByText('Primeira etapa')).toHaveCount(0);
  });

  test('avisa quando o processo do endereço não existe e abre outro', async ({
    page,
  }) => {
    await openEditor(page, { address: '/processos?processo=process-404' });

    await expect(
      page.getByRole('alert').filter({ hasText: 'O processo pedido' }),
    ).toHaveText(/O processo pedido no endereço não existe .+\./);
    await expect(processSelect(page)).toHaveValue(MAIN_PROCESS_ID);
  });
});
