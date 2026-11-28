import { act, within } from '@testing-library/react';

import type { ProcessDefinition } from '@/shared/process/catalog';
import { serializeCatalog } from '@/shared/process/catalog-format';
import { CATALOG_STORAGE_KEY } from '@/shared/process/catalog-store';
import {
  TEST_CREATED_AT,
  testDefinition,
} from '@/shared/process/catalog-test-data';
import { linearPlan } from '@/shared/process/engine-test-plans';
import type { ProcessPlan } from '@/shared/process/plan';

import type { Board } from './model/board';
import {
  boardProcess,
  processBoard,
  runningCard,
} from './model/process-test-data';
import {
  detailsPanel,
  openCard,
  renderStoredBoard,
} from './stored-board-test-kit';

/** Instante em que os testes de tela do processo acontecem: duas horas depois do início das execuções de teste. */
export const SCREEN_NOW = '2026-11-26T12:00:00.000Z';

/** Fixa o relógio dos testes de tela em `SCREEN_NOW`, sem mexer nos temporizadores, que a espera da tela usa. */
export function freezeClock(): void {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(SCREEN_NOW));
}

/** Devolve o relógio e limpa o que os testes de tela gravaram no navegador. */
export function releaseClock(): void {
  vi.useRealTimers();
  localStorage.clear();
}

export interface PublishedParams {
  readonly id: string;
  readonly name: string;
  readonly plan?: ProcessPlan;
  /** Quantas versões o processo tem publicadas; sem valor, uma. */
  readonly versions?: number;
}

/** Processo do catálogo com as versões publicadas, todas com o mesmo roteiro. */
export function published(params: PublishedParams): ProcessDefinition {
  const { id, name, plan = linearPlan, versions = 1 } = params;
  const numbers = Array.from({ length: versions }, (_, index) => index + 1);
  return testDefinition({
    id,
    name,
    versions: numbers.map((version) => ({
      version,
      publishedAt: TEST_CREATED_AT,
      documentText: `documento v${version}`,
      plan,
    })),
  });
}

/** Grava o catálogo de processos no navegador, de onde o quadro o lê. */
export function seedCatalog(definitions: readonly ProcessDefinition[]): void {
  localStorage.setItem(CATALOG_STORAGE_KEY, serializeCatalog({ definitions }));
}

/** Deixa as leituras em andamento (o catálogo de processos) terminarem e a tela se atualizar. */
export async function settled(): Promise<void> {
  await act(async () => undefined);
}

/** Quadro de teste com o card `c1` (Card c1) na coluna A fazer, seguindo o roteiro desde o início. */
export function boardRunning(plan: ProcessPlan): Board {
  return processBoard({
    todo: [runningCard({ id: 'c1', plan })],
    processes: [boardProcess(plan)],
  });
}

export function processSection(): HTMLElement {
  return within(detailsPanel()).getByRole('region', { name: 'Processo' });
}

/** Abre o card pelo título e devolve a seção "Processo" dele, com as leituras já terminadas. */
export async function openProcessOf(title: string): Promise<HTMLElement> {
  openCard(title);
  await settled();
  return processSection();
}

/** Monta o quadro gravado com o card `c1` seguindo o roteiro e abre a seção "Processo" dele. */
export async function renderRunning(plan: ProcessPlan): Promise<HTMLElement> {
  await renderStoredBoard(boardRunning(plan));
  return openProcessOf('Card c1');
}

/** A etapa ativa de nome dado, na seção "Processo" do card aberto. */
export function activeStep(name: string): HTMLElement {
  return within(processSection()).getByRole('listitem', { name });
}

/** Nomes das etapas ativas, na ordem da tela. */
export function activeStepNames(): (string | null)[] {
  const list = within(processSection()).queryByRole('list', {
    name: 'Etapas em andamento',
  });
  if (!list) {
    return [];
  }
  return within(list)
    .getAllByRole('heading', { level: 4 })
    .map((heading) => heading.textContent);
}
