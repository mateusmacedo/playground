import { expect } from '@playwright/test';

import { test } from './support/mock-test';
import {
  canvas,
  nodes,
  openEditor,
  port,
  properties,
  selectNode,
} from './support/process-editor-screen';

test.use({ viewport: { width: 1600, height: 1000 } });

test.describe('editor de processos: edição e recuperação', () => {
  test('duplica, copia e cola pelo teclado e desfaz', async ({ page }) => {
    await openEditor(page);
    await selectNode(page, 'Primeira etapa');

    await page.keyboard.press('ControlOrMeta+d');
    await expect(nodes(page)).toHaveCount(4);
    await page.keyboard.press('ControlOrMeta+c');
    await page.keyboard.press('ControlOrMeta+v');
    await expect(nodes(page)).toHaveCount(5);

    await page.keyboard.press('ControlOrMeta+z');
    await expect(nodes(page)).toHaveCount(4);
  });

  test('move a tarefa para outra raia e desfaz', async ({ page }) => {
    await openEditor(page);
    await page.getByRole('button', { name: 'Adicionar raia' }).click();
    await page.getByLabel('Nome da raia 1').fill('Jurídico');
    await selectNode(page, 'Primeira etapa');

    await properties(page)
      .getByLabel('Raia')
      .selectOption({ label: 'Jurídico' });
    await expect(properties(page).getByLabel('Raia')).toHaveValue(/.+/);

    await page.getByRole('button', { name: 'Desfazer' }).click();
    await expect(properties(page).getByLabel('Raia')).toHaveValue('');
  });

  test('leva ao bloco do problema e recupera o canvas limpo', async ({
    page,
  }) => {
    await openEditor(page);
    await page.getByRole('button', { name: 'Inserir Etapa' }).click();
    await canvas(page).click({ position: { x: 20, y: 20 } });

    await properties(page)
      .getByRole('button', { name: /Etapa não tem conexão de entrada/ })
      .click();
    await expect(
      properties(page).getByLabel('Título', { exact: true }),
    ).toHaveValue('Etapa');

    await page.getByRole('button', { name: 'Limpar' }).click();
    await page
      .getByRole('dialog', { name: 'Limpar o canvas' })
      .getByRole('button', { name: 'Limpar' })
      .click();
    await expect(nodes(page)).toHaveCount(0);
    await page.getByRole('button', { name: 'Desfazer' }).click();
    await expect(nodes(page)).toHaveCount(4);
  });
});

test.describe('editor de processos: blocos e operações', () => {
  test('insere na conexão pelo + e escolhe o tipo compatível', async ({
    page,
  }) => {
    await openEditor(page);

    await page
      .getByLabel('Inserir bloco na conexão de Início para Primeira etapa')
      .click();
    const picker = page.getByRole('dialog', {
      name: 'Inserir bloco na conexão',
    });
    await expect(picker.getByRole('button', { name: /^Fim/ })).toHaveCount(0);
    await picker.getByRole('button', { name: /^Temporizador/ }).click();

    await expect(nodes(page)).toHaveCount(4);
    await expect(canvas(page).locator('.react-flow__edge')).toHaveCount(3);
  });

  test('abre o subprocesso e volta pela trilha', async ({ page }) => {
    await openEditor(page);
    await page.getByRole('button', { name: 'Inserir Subprocesso' }).click();

    await properties(page)
      .getByRole('button', { name: 'Abrir subprocesso' })
      .click();
    const levels = page.getByRole('navigation', { name: 'Níveis do processo' });
    await expect(levels).toContainText('Subprocesso');
    await expect(nodes(page)).toHaveCount(2);

    await levels.getByRole('button', { name: 'Processo principal' }).click();
    await expect(levels).toBeHidden();
    await expect(nodes(page)).toHaveCount(4);
  });

  test('busca o bloco e abre as propriedades dele', async ({ page }) => {
    await openEditor(page);

    const search = page.getByRole('search', { name: 'Busca no processo' });
    await search
      .getByRole('searchbox', { name: 'Buscar no processo' })
      .fill('primeira');
    await search.getByRole('button', { name: /Primeira etapa/ }).click();

    await expect(
      properties(page).getByLabel('Título', { exact: true }),
    ).toHaveValue('Primeira etapa');
  });

  test('liga a junção à decisão inclusiva e mostra exceção não interruptiva', async ({
    page,
  }) => {
    await openEditor(page);
    await page
      .getByRole('button', { name: 'Inserir Decisão inclusiva' })
      .click();
    await page
      .getByRole('button', { name: 'Inserir Junção inclusiva' })
      .click();
    await expect(
      properties(page).getByLabel('Abertura correspondente'),
    ).not.toHaveValue('');

    await page
      .getByRole('button', { name: 'Inserir Tarefa automatizada' })
      .click();
    await properties(page)
      .getByRole('button', { name: 'Adicionar evento de exceção' })
      .click();
    await properties(page)
      .getByLabel(/Interrompe a atividade/)
      .uncheck();

    await expect(
      canvas(page).locator('.process-exception--non-interrupting'),
    ).toHaveCount(1);
  });

  test('troca o temporizador para data e horário', async ({ page }) => {
    await openEditor(page);
    await page.getByRole('button', { name: 'Inserir Temporizador' }).click();

    await properties(page)
      .getByLabel('Tipo de espera')
      .selectOption({ label: 'Até data e horário' });

    await expect(properties(page).getByLabel('Data e horário')).toBeVisible();
    await expect(properties(page).getByLabel('Duração')).toHaveCount(0);
  });

  test('alinha a seleção e organiza pelo layout automático', async ({
    page,
  }) => {
    await openEditor(page);
    await selectNode(page, 'Início');
    await nodes(page)
      .filter({ hasText: 'Primeira etapa' })
      .click({ modifiers: ['ControlOrMeta'] });

    await page.getByRole('button', { name: 'Alinhar', exact: true }).click();
    await page.getByRole('button', { name: 'Alinhar à esquerda' }).click();
    const start = await nodes(page).filter({ hasText: 'Início' }).boundingBox();
    const step = await nodes(page)
      .filter({ hasText: 'Primeira etapa' })
      .boundingBox();
    expect(start?.x).toBeCloseTo(step?.x ?? 0, 0);

    await page.getByRole('button', { name: 'Layout automático' }).click();
    await page.getByRole('button', { name: 'Desfazer' }).click();
    await expect(page.getByRole('button', { name: 'Refazer' })).toBeEnabled();
  });
});

test.describe('editor de processos: campos de relógio', () => {
  test('abre a saída de prazo só com o prazo ligado e recusa duração inválida', async ({
    page,
  }) => {
    await openEditor(page);
    await page.getByRole('button', { name: 'Inserir Aguardar evento' }).click();
    const expired = port(page, 'Saída Prazo expirado de Aguardar evento');
    await expect(expired).toHaveCount(0);

    await properties(page)
      .getByLabel('Tem prazo (abre a saída Prazo expirado)')
      .check();
    await expect(expired).toHaveCount(1);

    const amount = properties(page).getByLabel('Prazo', { exact: true });
    await amount.fill('0');
    await expect(
      properties(page).getByText('Use um número inteiro de 1 a 999.'),
    ).toBeVisible();
    await amount.fill('48');
    await expect(canvas(page).getByText('Prazo: 48 horas')).toBeVisible();
  });
});
