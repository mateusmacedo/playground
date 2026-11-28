import type { Locator } from '@playwright/test';

/** Posição e tamanho do elemento na tela; falha se ele não estiver visível. */
export async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error('O elemento não está visível.');
  }
  return box;
}
