import { expect, type Page } from '@playwright/test';

import { openBoard, openCard } from './support/board-screen';
import { activeStep, processSection } from './support/card-process-screen';
import { MAIN_PROCESS_ID } from './support/definition-documents';
import type { MockServer } from './support/mock-server';
import { test } from './support/mock-test';
import {
  EXAMPLE_PROCESS,
  unpublishedInitialDefinition,
} from './support/process-documents';
import {
  canvas,
  draftStatus,
  openEditor,
  properties,
  selectNode,
} from './support/process-editor-screen';
import {
  dialog,
  publish,
  publishButton,
  SAVED_ON_SERVER,
  saveDraft,
  versionsButton,
} from './support/process-workspace-screen';

test.use({ viewport: { width: 1600, height: 1000 } });

const RENAMED_STEP = 'Conferir pedido';

/** O selo da situação do processo aberto, ao lado do seletor. */
function statusBadge(page: Page, text: string) {
  return page.getByRole('main').getByText(text, { exact: true });
}

async function savedVersions(mock: MockServer): Promise<readonly number[]> {
  const stored = await mock.readDefinition(MAIN_PROCESS_ID);
  return stored?.definition.versions.map((version) => version.version) ?? [];
}

/** Renomeia a "Primeira etapa" pelo painel: a mudança que a versão 2 publica. */
async function renameFirstStep(page: Page) {
  await selectNode(page, 'Primeira etapa');
  await properties(page)
    .getByLabel('Título', { exact: true })
    .fill(RENAMED_STEP);
  await expect(canvas(page).getByText(RENAMED_STEP)).toBeVisible();
}

test.describe('editor de processos: publicação e versões', () => {
  test('publica a versão 1 de um processo que só tem rascunho', async ({
    page,
    mock,
  }) => {
    await mock.seedDefinition(unpublishedInitialDefinition());
    await openEditor(page);
    await expect(statusBadge(page, 'Rascunho')).toBeVisible();
    await expect(versionsButton(page)).toHaveText('Versões (0)');
    await expect(versionsButton(page)).toBeDisabled();

    await publish(page, 1);

    await expect(statusBadge(page, 'Publicada v1')).toBeVisible();
    await expect(versionsButton(page)).toHaveText('Versões (1)');
    await expect(draftStatus(page)).toHaveText(SAVED_ON_SERVER);
    await expect(publishButton(page)).toBeDisabled();
    await expect(publishButton(page)).toHaveAccessibleDescription(
      'Não há alterações desde a versão 1.',
    );
    await expect.poll(() => savedVersions(mock)).toEqual([1]);
  });

  test('recusa publicar com erros no desenho e explica o motivo', async ({
    page,
    mock,
  }) => {
    await openEditor(page);

    await page.getByRole('button', { name: 'Inserir Etapa' }).click();

    await expect(publishButton(page)).toBeDisabled();
    await expect(publishButton(page)).toHaveAccessibleDescription(
      'Corrija os 2 erros do processo para publicar.',
    );
    await page.getByRole('button', { name: 'Desfazer' }).click();
    await expect(publishButton(page)).toHaveAccessibleDescription(
      'Não há alterações desde a versão 1.',
    );
    expect(await savedVersions(mock)).toEqual([1]);
  });

  test('publica a versão 2 depois de mudar o rascunho e lista as versões', async ({
    page,
    mock,
  }) => {
    await openEditor(page);
    await renameFirstStep(page);
    await saveDraft(page);
    await expect(
      statusBadge(page, 'Publicada v1, com alterações não publicadas'),
    ).toBeVisible();

    await publish(page, 2);

    await expect(statusBadge(page, 'Publicada v2')).toBeVisible();
    await expect.poll(() => savedVersions(mock)).toEqual([1, 2]);
    await versionsButton(page).click();
    const versions = dialog(page, `Versões de ${EXAMPLE_PROCESS}`);
    await expect(versions.getByRole('listitem')).toHaveText([
      /^Versão 2 publicada em /,
      /^Versão 1 publicada em /,
    ]);

    await versions
      .getByRole('button', { name: 'Abrir a versão 1 como rascunho' })
      .click();
    await dialog(page, 'Abrir a versão 1 como rascunho')
      .getByRole('button', { name: 'Substituir o rascunho' })
      .click();
    await expect(canvas(page).getByText('Primeira etapa')).toBeVisible();
    await expect(
      statusBadge(page, 'Publicada v2, com alterações não publicadas'),
    ).toBeVisible();
  });

  test('oferece a versão publicada mais nova ao card do quadro', async ({
    page,
    mock,
  }) => {
    await openEditor(page);
    await renameFirstStep(page);
    await publish(page, 2);
    await expect.poll(() => savedVersions(mock)).toEqual([1, 2]);

    await openBoard(page);
    const section = processSection(await openCard(page, 'Item 1'));
    await section.getByRole('button', { name: 'Escolher processo' }).click();
    const picker = section.getByLabel('Processo', { exact: true });
    await expect(picker.getByRole('option')).toHaveText([
      `${EXAMPLE_PROCESS} (versão 2)`,
    ]);

    await section.getByRole('button', { name: 'Iniciar processo' }).click();
    await expect(activeStep(section, RENAMED_STEP)).toBeVisible();
  });
});
