import { expect } from '@playwright/test';

import { dragBetween } from './flow-drag';
import { test } from './support/mock-test';
import {
  edge,
  issueStatus,
  nodes,
  openEditor,
  port,
  properties,
  selectNode,
  selectWithOthers,
  toolbar,
} from './support/process-editor-screen';

test.use({ viewport: { width: 1600, height: 1000 } });

test.describe('editor de processos: reconexão, barra e foco', () => {
  test('religa a ponta da conexão e explica quando recusa', async ({
    page,
  }) => {
    await openEditor(page);
    await page.getByRole('button', { name: 'Inserir Fim' }).click();
    await properties(page)
      .getByLabel('Título', { exact: true })
      .fill('Encerrar');
    await page.getByRole('button', { name: 'Layout automático' }).click();
    await page.getByRole('button', { name: 'Ajustar à tela' }).click();

    await dragBetween({
      page,
      from: edge(page, 'Conexão de Primeira etapa para Fim').locator(
        '.react-flow__edgeupdater-target',
      ),
      to: port(page, 'Entrada de Encerrar'),
    });
    await expect(
      edge(page, 'Conexão de Primeira etapa para Encerrar'),
    ).toHaveCount(1);

    await dragBetween({
      page,
      from: edge(page, 'Conexão de Primeira etapa para Encerrar').locator(
        '.react-flow__edgeupdater-target',
      ),
      to: port(page, 'Entrada de Primeira etapa'),
    });
    await expect(
      page.getByRole('alert').filter({ hasText: 'Conexão recusada' }),
    ).toHaveText('Conexão recusada: o bloco não pode ligar a ele mesmo.');
    await expect(
      edge(page, 'Conexão de Primeira etapa para Encerrar'),
    ).toHaveCount(1);
  });

  test('distribui três blocos com espaços iguais', async ({ page }) => {
    await openEditor(page);
    await selectWithOthers(page, ['Início', 'Primeira etapa', 'Fim']);

    await page.getByRole('button', { name: 'Alinhar', exact: true }).click();
    await page.getByRole('button', { name: 'Distribuir na vertical' }).click();

    const tops: number[] = [];
    for (const text of ['Início', 'Primeira etapa', 'Fim']) {
      const box = await nodes(page)
        .filter({ hasText: text })
        .first()
        .boundingBox();
      tops.push(box?.y ?? 0);
    }
    expect(tops[1] - tops[0]).toBeCloseTo(tops[2] - tops[1], 0);
  });

  test('habilita a barra conforme histórico e seleção e mostra o foco', async ({
    page,
  }) => {
    await openEditor(page);
    const button = (name: string) =>
      toolbar(page).getByRole('button', { name, exact: true });
    await expect(button('Desfazer')).toBeDisabled();
    await expect(button('Duplicar')).toBeDisabled();
    await expect(button('Alinhar')).toBeDisabled();

    await selectNode(page, 'Primeira etapa');
    await expect(button('Duplicar')).toBeEnabled();
    await expect(button('Alinhar')).toBeDisabled();
    await selectWithOthers(page, ['Primeira etapa', 'Fim']);
    await expect(button('Alinhar')).toBeEnabled();

    await page.getByRole('button', { name: 'Inserir Etapa' }).click();
    await expect(button('Desfazer')).toBeEnabled();

    const focused = nodes(page).filter({ hasText: 'Início' }).first();
    await page.keyboard.press('Tab');
    await focused.focus();
    await expect(focused).toBeFocused();
    await expect(focused).toHaveCSS('outline-style', 'solid');
  });
});

test.describe('editor de processos: acessibilidade', () => {
  test('declara atalhos, nomeia as portas e anuncia os problemas', async ({
    page,
  }) => {
    await openEditor(page);

    await expect(
      page.getByRole('button', { name: 'Desfazer' }),
    ).toHaveAttribute('aria-keyshortcuts', 'Control+Z Meta+Z');
    await expect(port(page, 'Saída de Início')).toHaveCount(1);
    await expect(port(page, 'Entrada de Primeira etapa')).toHaveCount(1);
    await expect(
      page.getByRole('search', { name: 'Busca no processo' }),
    ).toBeVisible();

    await page
      .getByRole('button', { name: 'Inserir Decisão exclusiva' })
      .click();
    await expect(port(page, 'Ramo Sim de Decisão exclusiva')).toHaveCount(1);
    await expect(issueStatus(page)).toHaveText('3 problemas: 3 erros');
  });
});
