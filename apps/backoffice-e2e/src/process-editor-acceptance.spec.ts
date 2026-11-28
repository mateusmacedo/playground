import { expect, type Page } from '@playwright/test';

import {
  DECISION_DRAFT,
  LANES_DRAFT,
  mainProcessWith,
} from './support/editor-acceptance-drafts';
import { clickEdge, viewportOf } from './support/flow-geometry';
import { test } from './support/mock-test';
import { LANE_WIDTH } from './support/process-drafts';
import {
  canvas,
  edge,
  issueStatus,
  nodes,
  openEditor,
  port,
  properties,
  selectNode,
  toolbar,
} from './support/process-editor-screen';

test.use({ viewport: { width: 1600, height: 1000 } });

const DRAG_STEPS = 10;

function roleField(page: Page) {
  return properties(page).getByLabel('Papel responsável');
}

test.describe('editor de processos: aceite da edição', () => {
  test('corrige um problema pelo painel e a contagem de problemas cai', async ({
    page,
  }) => {
    await openEditor(page);
    await page.getByRole('button', { name: 'Inserir Tarefa humana' }).click();
    await expect(issueStatus(page)).toHaveText(
      '3 problemas: 2 erros e 1 aviso',
    );
    await canvas(page).click({ position: { x: 20, y: 20 } });

    await properties(page)
      .getByRole('button', { name: /Tarefa humana não tem papel responsável/ })
      .click();
    await expect(
      properties(page).getByLabel('Título', { exact: true }),
    ).toHaveValue('Tarefa humana');
    await roleField(page).fill('Financeiro');

    await expect(issueStatus(page)).toHaveText('2 problemas: 2 erros');
    await expect(
      properties(page).getByRole('button', {
        name: /não tem papel responsável/,
      }),
    ).toHaveCount(0);
  });

  test('arrasta a tarefa para outra raia, troca o responsável e desfaz', async ({
    page,
    mock,
  }) => {
    await mock.seedDefinition(mainProcessWith(LANES_DRAFT));
    await openEditor(page, { block: 'Analisar contrato' });
    await toolbar(page).getByRole('button', { name: 'Ajustar à tela' }).click();
    const task = nodes(page).filter({ hasText: 'Analisar contrato' });
    const box = await task.boundingBox();
    if (box === null) {
      throw new Error('A tarefa não está na tela.');
    }
    const { zoom } = await viewportOf(page);
    const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + LANE_WIDTH * zoom, start.y, {
      steps: DRAG_STEPS,
    });
    await page.mouse.up();
    await selectNode(page, 'Analisar contrato');

    // NOTE: com a tarefa numa raia, o papel responsável vem do nome dela e aparece como texto, sem campo para editar.
    await expect(
      properties(page).getByText('Papel responsável: Jurídico'),
    ).toBeVisible();
    await expect(properties(page).getByLabel('Raia')).toHaveValue('lane-legal');
    await toolbar(page).getByRole('button', { name: 'Desfazer' }).click();
    await expect(
      toolbar(page).getByRole('button', { name: 'Desfazer' }),
    ).toBeDisabled();
    // NOTE: o desfazer volta à seleção de antes do arraste, quando nada estava selecionado.
    await selectNode(page, 'Analisar contrato');
    await expect(
      properties(page).getByText('Papel responsável: Comercial'),
    ).toBeVisible();
    await expect(properties(page).getByLabel('Raia')).toHaveValue('lane-sales');
  });

  test('renomeia um ramo com a conexão junto e remove outro com a saída e a ligação', async ({
    page,
    mock,
  }) => {
    await mock.seedDefinition(mainProcessWith(DECISION_DRAFT));
    await openEditor(page, { block: 'Valor alto?' });
    await expect(
      edge(page, 'Conexão de Valor alto? para Pedir cotação, Sim'),
    ).toHaveCount(1);
    await selectNode(page, 'Valor alto?');

    await properties(page).getByLabel('Nome do ramo 1').fill('Acima do limite');
    await expect(
      edge(page, 'Conexão de Valor alto? para Pedir cotação, Acima do limite'),
    ).toHaveCount(1);
    await expect(port(page, 'Ramo Acima do limite de Valor alto?')).toHaveCount(
      1,
    );

    await properties(page)
      .getByRole('button', { name: 'Remover o ramo Não' })
      .click();
    await expect(port(page, 'Ramo Não de Valor alto?')).toHaveCount(0);
    await expect(
      edge(page, 'Conexão de Valor alto? para Pagar, Não'),
    ).toHaveCount(0);
    await expect(canvas(page).locator('.react-flow__edge')).toHaveCount(4);
    await expect(nodes(page)).toHaveCount(5);
  });

  test('converte a Etapa em Tarefa humana com os dados e as conexões preservados', async ({
    page,
  }) => {
    await openEditor(page);
    await selectNode(page, 'Primeira etapa');
    await properties(page)
      .getByRole('button', { name: 'Adicionar campo' })
      .click();
    await properties(page).getByLabel('Nome do campo 1').fill('Valor');

    await properties(page)
      .getByRole('button', { name: 'Converter em Tarefa humana' })
      .click();
    const confirm = page.getByRole('dialog', {
      name: 'Converter em Tarefa humana',
    });
    await expect(confirm).toContainText('Sem incompatibilidades');
    await confirm.getByRole('button', { name: 'Converter' }).click();

    await expect(properties(page)).toContainText(
      /^Propriedades\s*Tarefa humana:/,
    );
    await expect(
      properties(page).getByLabel('Título', { exact: true }),
    ).toHaveValue('Primeira etapa');
    await expect(properties(page).getByLabel('Descrição')).toHaveValue(
      'Descreva a atividade.',
    );
    await expect(properties(page).getByLabel('Nome do campo 1')).toHaveValue(
      'Valor',
    );
    await expect(roleField(page)).toHaveValue('');
    await expect(
      edge(page, 'Conexão de Início para Primeira etapa'),
    ).toHaveCount(1);
    await expect(edge(page, 'Conexão de Primeira etapa para Fim')).toHaveCount(
      1,
    );

    await toolbar(page).getByRole('button', { name: 'Desfazer' }).click();
    await expect(
      canvas(page).getByRole('group', { name: 'Etapa: Primeira etapa' }),
    ).toHaveCount(1);
  });

  test('a exceção nasce interrompendo a atividade, com traço contínuo, e passa a tracejado sem interromper', async ({
    page,
  }) => {
    await openEditor(page);
    await page
      .getByRole('button', { name: 'Inserir Tarefa automatizada' })
      .click();
    await properties(page)
      .getByRole('button', { name: 'Adicionar evento de exceção' })
      .click();
    const interrupting = properties(page).getByLabel(/Interrompe a atividade/);
    const exception = nodes(page)
      .filter({ hasText: /^Evento de exceção: / })
      .getByTitle(/.+/)
      .first();

    await expect(interrupting).toBeChecked();
    await expect(exception).toHaveCSS('border-top-style', 'solid');

    await interrupting.uncheck();
    await expect(interrupting).not.toBeChecked();
    await expect(exception).toHaveCSS('border-top-style', 'dashed');
  });

  test('deixa "Duplicar" desabilitado com só conexões selecionadas', async ({
    page,
  }) => {
    await openEditor(page);
    const duplicate = toolbar(page).getByRole('button', { name: 'Duplicar' });

    await clickEdge({
      page,
      edge: edge(page, 'Conexão de Início para Primeira etapa'),
    });
    await expect(properties(page)).toContainText('Origem');
    await expect(duplicate).toBeDisabled();
    await expect(
      properties(page).getByRole('button', { name: 'Duplicar' }),
    ).toHaveCount(0);
    await clickEdge({
      page,
      edge: edge(page, 'Conexão de Primeira etapa para Fim'),
      addToSelection: true,
    });

    const panelDuplicate = properties(page).getByRole('button', {
      name: 'Duplicar',
    });
    await expect(panelDuplicate).toBeDisabled();
    await expect(panelDuplicate).toHaveAccessibleDescription(
      'Para duplicar, a seleção precisa ter ao menos um bloco.',
    );
    await expect(duplicate).toBeDisabled();
    await page.keyboard.press('ControlOrMeta+d');
    await expect(nodes(page)).toHaveCount(3);

    await nodes(page)
      .filter({ hasText: 'Primeira etapa' })
      .click({ modifiers: ['ControlOrMeta'] });
    await expect(duplicate).toBeEnabled();
    await expect(panelDuplicate).toBeEnabled();
  });
});
