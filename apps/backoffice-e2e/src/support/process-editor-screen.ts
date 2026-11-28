import { expect, type Locator, type Page } from '@playwright/test';

const EDITOR_ADDRESS = '/processos';
/** Bloco do processo dos dados iniciais do mock, que o editor abre quando o endereço não pede outro. */
const INITIAL_BLOCK = 'Primeira etapa';

export function canvas(page: Page): Locator {
  return page.getByLabel('Canvas do processo');
}

/** Os blocos do canvas, na ordem em que entraram. */
export function nodes(page: Page): Locator {
  return canvas(page).locator('.react-flow__node');
}

/** O painel de propriedades, à direita do canvas. */
export function properties(page: Page): Locator {
  return page.getByRole('region', { name: 'Propriedades' });
}

/** A barra de ações do editor, acima do canvas. */
export function toolbar(page: Page): Locator {
  return page.getByRole('toolbar', { name: 'Ações do editor' });
}

/**
 * O selo de problemas da barra. O texto dele junta o total e as severidades ("2 problemas: 2 erros",
 * "3 problemas: 2 erros e 1 aviso"); sem problema, é só "Sem problemas".
 */
export function issueStatus(page: Page): Locator {
  return toolbar(page).getByRole('status');
}

/** A situação do rascunho, ao lado de "Salvar rascunho" ("Rascunho salvo no servidor.", "Alterações não salvas."). */
export function draftStatus(page: Page): Locator {
  return page
    .getByRole('status')
    .filter({ hasText: /ascunho|Alterações|Salvando/ });
}

/** O ponto de ligação de um bloco, pelo nome dele ("Saída de Início", "Ramo Sim de Aprovado?"). */
export function port(page: Page, label: string): Locator {
  return page.getByLabel(label, { exact: true });
}

/** A conexão do canvas, pelo nome dela ("Conexão de Início para Primeira etapa"). */
export function edge(page: Page, name: string): Locator {
  return canvas(page).getByRole('group', { name, exact: true });
}

export interface OpenEditorOptions {
  /** Endereço a abrir; o padrão é o editor sem processo pedido (`/processos`). */
  readonly address?: string;
  /** Texto de um bloco do processo que vai abrir; o padrão é o do processo dos dados iniciais do mock. */
  readonly block?: string;
}

/**
 * Abre o editor e espera um bloco do processo no canvas: ele só aparece depois de o catálogo chegar da API e de o
 * React Flow medir os blocos.
 */
export async function openEditor(page: Page, options: OpenEditorOptions = {}) {
  const { address = EDITOR_ADDRESS, block = INITIAL_BLOCK } = options;
  await page.goto(address);
  await expect(canvas(page).getByText(block)).toBeVisible();
}

/** Seleciona o bloco pelo clique. */
export async function selectNode(page: Page, text: string) {
  await nodes(page).filter({ hasText: text }).first().click();
}

/** Seleciona o primeiro bloco e acrescenta os outros à seleção, com Ctrl ou Cmd. */
export async function selectWithOthers(page: Page, texts: readonly string[]) {
  const [first, ...rest] = texts;
  await selectNode(page, first ?? '');
  for (const text of rest) {
    await nodes(page)
      .filter({ hasText: text })
      .first()
      .click({ modifiers: ['ControlOrMeta'] });
  }
}
