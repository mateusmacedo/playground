import { expect, type Locator, type Page } from '@playwright/test';

/** O menu lateral do painel. */
export function sideMenu(page: Page): Locator {
  return page.getByRole('navigation', { name: 'Menu lateral', exact: true });
}

/**
 * Um link do menu, pelo nome. O casamento é por trecho, porque o selo entra no nome ("Quadro Beta"); o botão que abre
 * um grupo também é um link ("Processos Beta"). O filho de um grupo fechado não existe para esta busca: abra o grupo.
 */
export function menuLink(page: Page, name: string): Locator {
  return sideMenu(page).getByRole('link', { name });
}

/** Abre o grupo do menu pelo clique e devolve o botão dele. */
export async function openMenuGroup(
  page: Page,
  name: string,
): Promise<Locator> {
  const group = menuLink(page, name);
  // WHY: o HTML chega antes da hidratação e um clique nesse intervalo se perde, então repete até abrir; a checagem do
  // `aria-expanded` impede que uma repetição feche o grupo que o clique anterior já abriu.
  await expect(async () => {
    if ((await group.getAttribute('aria-expanded')) !== 'true') {
      await group.click();
    }
    await expect(group).toHaveAttribute('aria-expanded', 'true', {
      timeout: 1000,
    });
  }).toPass();
  return group;
}

export interface OpenByMenuParams {
  readonly page: Page;
  readonly group: string;
  readonly item: string;
}

/** Abre o grupo e segue para o filho dele, como quem navega pelo menu ("Processos" e depois "Editor"). */
export async function openByMenu({ page, group, item }: OpenByMenuParams) {
  await openMenuGroup(page, group);
  await menuLink(page, item).click();
}
