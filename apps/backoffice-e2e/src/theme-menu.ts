import { expect, type Page } from '@playwright/test';

const THEME_TOGGLE_NAME = 'Escolher o tema';

/** Abre o menu de tema sem fechá-lo: só clica enquanto ele está fechado (`aria-expanded` diferente de `true`). */
export async function openThemeMenu(page: Page) {
  const toggle = page.getByRole('button', { name: THEME_TOGGLE_NAME });
  // WHY: o HTML chega antes da hidratação do React e um clique nesse intervalo se perde, então repete até abrir; a
  // checagem do `aria-expanded` impede que uma repetição feche o menu que o clique anterior já abriu.
  await expect(async () => {
    if ((await toggle.getAttribute('aria-expanded')) !== 'true') {
      await toggle.click();
    }
    await expect(toggle).toHaveAttribute('aria-expanded', 'true', {
      timeout: 1000,
    });
  }).toPass();
}
