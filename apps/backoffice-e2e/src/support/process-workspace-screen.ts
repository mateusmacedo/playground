import { expect, type Locator, type Page } from '@playwright/test';

import { draftStatus } from './process-editor-screen';

/** O texto da situação do rascunho depois de gravado no mock. */
export const SAVED_ON_SERVER = 'Rascunho salvo no servidor.';

/** O seletor do processo aberto, acima da barra do rascunho. */
export function processSelect(page: Page): Locator {
  return page.getByRole('combobox', { name: 'Processo', exact: true });
}

/** Uma janela do editor, pelo título dela ("Novo processo", "Arquivar processo", "Versões de ..."). */
export function dialog(page: Page, name: string): Locator {
  return page.getByRole('dialog', { name });
}

/** "Publicar versão", na barra do rascunho. */
export function publishButton(page: Page): Locator {
  return page.getByRole('button', { name: 'Publicar versão' });
}

/** O acesso às versões publicadas, cujo nome traz a quantidade ("Versões (2)"). */
export function versionsButton(page: Page): Locator {
  return page.getByRole('button', { name: /^Versões \(\d+\)$/ });
}

/** O resultado da última publicação ("Versão 2 publicada."). */
export function publishFeedback(page: Page): Locator {
  return page
    .getByRole('status')
    .filter({ hasText: /^Versão \d+ publicada\.$/ });
}

/** Abre o menu "Ações do processo" e aciona o item pelo nome. */
export async function chooseProcessAction(page: Page, item: string) {
  await page.getByRole('button', { name: /^Ações do processo / }).click();
  await page.getByRole('menu').getByRole('button', { name: item }).click();
}

export interface NameDialogParams {
  readonly page: Page;
  /** O título da janela: "Novo processo" ou "Renomear processo". */
  readonly title: string;
  readonly name: string;
  /** O botão que confirma: "Criar processo" ou "Renomear". */
  readonly confirm: string;
}

/** Preenche o nome do processo na janela e confirma. */
export async function fillProcessName({
  page,
  title,
  name,
  confirm,
}: NameDialogParams) {
  const window = dialog(page, title);
  await window.getByLabel('Nome do processo').fill(name);
  await window.getByRole('button', { name: confirm }).click();
  await expect(window).toBeHidden();
}

/** Salva o rascunho e espera a confirmação de que ele chegou ao servidor. */
export async function saveDraft(page: Page) {
  await page.getByRole('button', { name: 'Salvar rascunho' }).click();
  await expect(draftStatus(page)).toHaveText(SAVED_ON_SERVER);
}

/** Publica o processo aberto e espera a confirmação da versão. */
export async function publish(page: Page, version: number) {
  await publishButton(page).click();
  await expect(publishFeedback(page)).toHaveText(
    `Versão ${version} publicada.`,
  );
}
