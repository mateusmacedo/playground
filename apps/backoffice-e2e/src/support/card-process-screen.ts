import { expect, type Locator, type Page } from '@playwright/test';

import { cardSection, openCard } from './board-screen';

/** A seção "Processo" do painel do card. */
export function processSection(details: Locator): Locator {
  return cardSection(details, 'Processo');
}

/** Uma etapa em que o processo do card está parado, pelo nome dela. */
export function activeStep(section: Locator, name: string): Locator {
  return section
    .getByRole('list', { name: 'Etapas em andamento' })
    .getByRole('listitem', { name, exact: true });
}

/** O resumo da trilha da execução, que abre e fecha a lista dos registros. */
export function trailSummary(section: Locator): Locator {
  return section.getByText(/^Trilha da execução \(\d+ registros?\)$/);
}

export interface ChooseProcessParams {
  readonly section: Locator;
  readonly processName: string;
  /** O botão que abre a escolha: "Escolher processo" sem processo, "Iniciar outro processo" depois do fim. */
  readonly openLabel?: string;
  readonly version?: number;
}

/** Escolhe o processo no catálogo e o inicia, e espera a primeira etapa aparecer. */
export async function chooseProcess({
  section,
  processName,
  openLabel = 'Escolher processo',
  version = 1,
}: ChooseProcessParams) {
  await section.getByRole('button', { name: openLabel }).click();
  await section
    .getByLabel('Processo', { exact: true })
    .selectOption({ label: `${processName} (versão ${version})` });
  await section.getByRole('button', { name: 'Iniciar processo' }).click();
  await expect(
    section.getByRole('list', { name: 'Etapas em andamento' }),
  ).toBeVisible();
}

export interface StartProcessParams {
  readonly page: Page;
  readonly cardTitle: string;
  readonly processName: string;
}

/** Abre o card, inicia o processo nele e devolve a seção "Processo" do painel. */
export async function startProcess({
  page,
  cardTitle,
  processName,
}: StartProcessParams): Promise<Locator> {
  const details = await openCard(page, cardTitle);
  const section = processSection(details);
  await chooseProcess({ section, processName });
  return section;
}
