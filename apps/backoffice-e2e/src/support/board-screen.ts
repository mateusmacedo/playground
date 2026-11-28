import { expect, type Locator, type Page } from '@playwright/test';

const BOARD_ADDRESS = '/quadro';

/** A coluna do quadro, pelo título dela. */
export function lane(page: Page, name: string): Locator {
  return page.getByRole('region', { name });
}

/** Os títulos dos cards de uma coluna, na ordem da tela. */
export function cardTitles(page: Page, laneName: string): Locator {
  return lane(page, laneName).getByRole('heading', { level: 3 });
}

/** O card do quadro, pelo título exato. */
export function card(page: Page, title: string): Locator {
  return page
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name: title, exact: true }) });
}

/**
 * Abre o quadro e espera as colunas, que só aparecem depois de a lista de quadros e o quadro chegarem da API. Passe o
 * endereço para abrir outro quadro (`/quadro?quadro=board-2`).
 */
export async function openBoard(page: Page, address: string = BOARD_ADDRESS) {
  await page.goto(address);
  // NOTE: a coluna automática dos arquivados existe em todo quadro, até no que não tem coluna.
  await expect(lane(page, 'Arquivados')).toBeVisible();
}

/** Abre o painel do card pelo clique no título e devolve o painel. */
export async function openCard(page: Page, title: string): Promise<Locator> {
  const details = page.getByRole('dialog', { name: 'Detalhes do card' });
  // WHY: o clique que chega antes de o quadro terminar de montar se perde; repete até o painel abrir, sem clicar de
  // novo com ele aberto.
  await expect(async () => {
    if (!(await details.isVisible())) {
      await page.getByRole('button', { name: title, exact: true }).click();
    }
    await expect(details).toBeVisible({ timeout: 1000 });
  }).toPass();
  return details;
}

/** Fecha o painel do card e espera ele sair da tela, para que o próximo `openCard` não o ache ainda aberto. */
export async function closeCard(page: Page) {
  const details = page.getByRole('dialog', { name: 'Detalhes do card' });
  await details.getByRole('button', { name: 'Fechar os detalhes' }).click();
  await expect(details).toBeHidden();
}

/** A região viva do quadro, que anuncia ao leitor de tela cada mudança aceita. */
export function announcement(page: Page): Locator {
  return page.getByRole('status', { name: 'Avisos do quadro' });
}

/** A seção do painel do card, pelo título dela ("Processo", "Cards filhos", "Dependências"). */
export function cardSection(details: Locator, name: string): Locator {
  return details.getByRole('region', { name });
}

export interface AddCardParams {
  readonly page: Page;
  readonly laneName: string;
  readonly title: string;
}

/** Cria um card no fim da coluna, pelo formulário dela. */
export async function addCard({ page, laneName, title }: AddCardParams) {
  const target = lane(page, laneName);
  const open = target.getByRole('button', { name: 'Adicionar card' });
  const field = target.getByRole('textbox', {
    name: `Título do novo card em ${laneName}`,
  });
  // WHY: mesmo motivo do `openCard`; o botão some quando o campo abre, então a repetição não o fecha.
  await expect(async () => {
    if (await open.isVisible()) {
      await open.click();
    }
    await expect(field).toBeVisible({ timeout: 1000 });
  }).toPass();
  await field.fill(title);
  await field.press('Enter');
  await expect(cardTitles(page, laneName).last()).toHaveText(title);
}
