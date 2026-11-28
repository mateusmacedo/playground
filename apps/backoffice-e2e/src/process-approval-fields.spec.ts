import { expect, type Locator, type Page } from '@playwright/test';

import { dragToArea } from './flow-drag';
import { openBoard, openCard } from './support/board-screen';
import {
  activeStep,
  chooseProcess,
  processSection,
} from './support/card-process-screen';
import { test } from './support/mock-test';
import { EXAMPLE_PROCESS } from './support/process-documents';
import {
  canvas,
  edge,
  issueStatus,
  openEditor,
  port,
  properties,
  selectNode,
} from './support/process-editor-screen';
import { publish } from './support/process-workspace-screen';

test.use({ viewport: { width: 1600, height: 1000 } });

/** Distância do canto de cima à esquerda do canvas até o ponto vazio onde a saída é solta. */
const EMPTY_CORNER = 40;

/** Os campos a preencher no painel do bloco selecionado. */
function stepFields(page: Page): Locator {
  return properties(page).getByRole('group', { name: 'Campos a preencher' });
}

async function addField(page: Page) {
  await stepFields(page)
    .getByRole('button', { name: 'Adicionar campo' })
    .click();
}

interface FieldParams {
  readonly page: Page;
  readonly position: number;
  readonly name: string;
  readonly type?: string;
  readonly required?: boolean;
}

/** Dá nome, tipo e obrigatoriedade ao campo da posição indicada. */
async function defineField({
  page,
  position,
  name,
  type,
  required = false,
}: FieldParams) {
  const fields = stepFields(page);
  await fields.getByLabel(`Nome do campo ${position}`).fill(name);
  if (type !== undefined) {
    await fields.getByLabel(`Tipo do campo ${name}`).selectOption({
      label: type,
    });
  }
  if (required) {
    await fields.getByLabel(`Campo ${name} obrigatório`).check();
  }
}

test.describe('editor de processos: aprovação', () => {
  test('insere a Aprovação na conexão, com as saídas Aprovado e Rejeitado', async ({
    page,
  }) => {
    await openEditor(page);

    await page
      .getByLabel('Inserir bloco na conexão de Primeira etapa para Fim')
      .click();
    await page
      .getByRole('dialog', { name: 'Inserir bloco na conexão' })
      .getByRole('button', { name: /^Aprovação/ })
      .click();

    await expect(port(page, 'Saída Aprovado de Aprovação')).toHaveCount(1);
    await expect(port(page, 'Saída Rejeitado de Aprovação')).toHaveCount(1);
    // NOTE: o inserido na conexão segue pela saída favorável, e o nome da conexão traz o parecer.
    await expect(
      edge(page, 'Conexão de Aprovação para Fim, Aprovado'),
    ).toHaveCount(1);
    await expect(issueStatus(page)).toHaveText('2 problemas: 1 erro e 1 aviso');

    await properties(page).getByLabel('Papel aprovador').fill('Diretoria');
    await expect(canvas(page).getByText('Aprovador: Diretoria')).toBeVisible();
    await expect(issueStatus(page)).toHaveText('1 problema: 1 erro');

    // WHY: inserida na conexão, a Aprovação fica à direita, e ao ajustar à tela a saída Rejeitado cai sob o minimapa,
    // que puxaria o canvas em vez de começar a ligação; organizados em coluna, os blocos ficam longe dele.
    await page.getByRole('button', { name: 'Layout automático' }).click();
    await page.getByRole('button', { name: 'Ajustar à tela' }).click();
    await dragToArea({
      page,
      from: port(page, 'Saída Rejeitado de Aprovação'),
      area: canvas(page),
      offset: { x: EMPTY_CORNER, y: EMPTY_CORNER },
    });
    await page
      .getByRole('dialog', { name: 'Criar bloco ligado à saída' })
      .getByRole('button', { name: /^Fim/ })
      .click();

    await expect(issueStatus(page)).toHaveText('Sem problemas');
    await expect(
      canvas(page).getByRole('group', {
        name: /^Conexão de Aprovação para .+, Rejeitado$/,
      }),
    ).toHaveCount(1);
  });
});

test.describe('editor de processos: campos a preencher', () => {
  test('define os campos da etapa e aponta nome repetido, nome vazio e lista sem opção', async ({
    page,
  }) => {
    await openEditor(page);
    await selectNode(page, 'Primeira etapa');
    await expect(stepFields(page)).toContainText('Nenhum campo');

    await addField(page);
    await expect(stepFields(page).getByLabel('Nome do campo 1')).toHaveValue(
      'Campo 1',
    );
    await defineField({
      page,
      position: 1,
      name: 'Valor',
      type: 'Número',
      required: true,
    });
    await expect(issueStatus(page)).toHaveText('Sem problemas');

    await addField(page);
    await defineField({ page, position: 2, name: 'valor' });
    await expect(stepFields(page)).toContainText(
      'Já existe um campo com este nome.',
    );
    await expect(issueStatus(page)).toHaveText('1 problema: 1 erro');

    await stepFields(page).getByLabel('Nome do campo 2').fill('');
    await expect(stepFields(page)).toContainText('Dê um nome ao campo.');
    await expect(issueStatus(page)).toHaveText('1 problema: 1 erro');

    await defineField({
      page,
      position: 2,
      name: 'Motivo',
      type: 'Lista de opções',
    });
    await expect(stepFields(page)).toContainText('Escreva ao menos uma opção.');
    await expect(issueStatus(page)).toHaveText('1 problema: 1 erro');

    await stepFields(page)
      .getByLabel('Opções do campo Motivo')
      .fill('Compra\nVenda');
    await expect(issueStatus(page)).toHaveText('Sem problemas');
    await expect(
      stepFields(page).getByLabel('Campo Valor obrigatório'),
    ).toBeChecked();
    await expect(
      stepFields(page).getByLabel('Campo Motivo obrigatório'),
    ).not.toBeChecked();
  });

  test('pede no card os campos obrigatórios do processo publicado', async ({
    page,
  }) => {
    await openEditor(page);
    await selectNode(page, 'Primeira etapa');
    await addField(page);
    await defineField({
      page,
      position: 1,
      name: 'Valor',
      type: 'Número',
      required: true,
    });
    await addField(page);
    await defineField({
      page,
      position: 2,
      name: 'Motivo',
      type: 'Lista de opções',
      required: true,
    });
    await stepFields(page)
      .getByLabel('Opções do campo Motivo')
      .fill('Compra\nVenda');
    await publish(page, 2);

    await openBoard(page);
    const section = processSection(await openCard(page, 'Item 1'));
    await chooseProcess({ section, processName: EXAMPLE_PROCESS, version: 2 });
    const step = activeStep(section, 'Primeira etapa');
    await step.getByRole('button', { name: 'Concluir etapa' }).click();
    await expect(step.getByRole('alert')).toHaveText(
      'Preencha os campos obrigatórios: Valor, Motivo.',
    );

    await step.getByLabel('Valor', { exact: true }).fill('1500');
    await step.getByLabel('Motivo', { exact: true }).selectOption('Venda');
    await step.getByRole('button', { name: 'Concluir etapa' }).click();

    await expect(step).toHaveCount(0);
    await expect(section.getByText('Concluído', { exact: true })).toBeVisible();
  });
});
