import { expect, type Locator, type Page, test } from '@playwright/test';

// WHY: com dezesseis blocos, uma janela baixa leva o enquadramento ao zoom mínimo, e o minimapa cobre as saídas de baixo.
test.use({ viewport: { width: 1600, height: 1400 } });

function canvas(page: Page): Locator {
  return page.getByLabel('Canvas do processo');
}

function properties(page: Page): Locator {
  return page.getByRole('region', { name: 'Propriedades' });
}

function issueStatus(page: Page): Locator {
  return page
    .getByRole('toolbar', { name: 'Ações do editor' })
    .getByRole('status');
}

function port(page: Page, label: string): Locator {
  return page.getByLabel(label, { exact: true });
}

async function openEmptyCanvas(page: Page) {
  await page.goto('/processos');
  await expect(canvas(page).getByText('Primeira etapa')).toBeVisible();
  await page.getByRole('button', { name: 'Limpar' }).click();
  const confirm = page.getByRole('dialog', { name: 'Limpar o canvas' });
  await confirm.getByRole('button', { name: 'Limpar' }).click();
  await expect(canvas(page).locator('.react-flow__node')).toHaveCount(0);
}

/** Organiza e afasta a vista, deixando o canto superior esquerdo do canvas livre para soltar uma ligação. */
async function makeRoom(page: Page) {
  await page.getByRole('button', { name: 'Layout automático' }).click();
  await page.getByRole('button', { name: 'Ajustar à tela' }).click();
  const zoomOut = page.getByRole('button', { name: 'Diminuir o zoom' });
  // NOTE: com o processo grande o enquadramento já chega perto do zoom mínimo, e o botão desabilita.
  for (let step = 0; step < 2; step += 1) {
    if (await zoomOut.isEnabled()) {
      await zoomOut.click();
    }
  }
}

interface Fields {
  readonly [label: string]: string;
}

/** Preenche o título e os campos do bloco selecionado no painel. */
async function fill(page: Page, title: string, fields: Fields = {}) {
  await properties(page).getByLabel('Título', { exact: true }).fill(title);
  for (const [label, value] of Object.entries(fields)) {
    await properties(page).getByLabel(label, { exact: true }).fill(value);
  }
}

interface CreateFromParams {
  readonly from: string;
  readonly kind: string;
  readonly title: string;
  readonly fields?: Fields;
}

/** Solta uma ligação numa área vazia, escolhe o tipo na biblioteca filtrada e preenche o bloco criado. */
async function createFrom(page: Page, params: CreateFromParams) {
  await makeRoom(page);
  await port(page, params.from).dragTo(canvas(page), {
    targetPosition: { x: 40, y: 40 },
  });
  const picker = page.getByRole('dialog', {
    name: 'Criar bloco ligado à saída',
  });
  await picker
    .getByRole('button', { name: new RegExp(`^${params.kind}`) })
    .click();
  await expect(picker).toBeHidden();
  await fill(page, params.title, params.fields);
}

async function connect(page: Page, from: string, to: string) {
  await makeRoom(page);
  await port(page, from).dragTo(port(page, to));
}

test.describe('editor de processos: fluxo de referência', () => {
  test('monta do canvas vazio o processo com retorno, expiração, paralelismo e exceção', async ({
    page,
  }) => {
    // WHY: são dezesseis blocos montados só pela tela, cada um com organizar, enquadrar e soltar a ligação.
    test.slow();
    await openEmptyCanvas(page);
    await page.getByRole('button', { name: 'Inserir Início' }).click();

    await createFrom(page, {
      from: 'Saída de Início',
      kind: 'Convergência de alternativas',
      title: 'Retorno',
    });
    await createFrom(page, {
      from: 'Saída de Retorno',
      kind: 'Tarefa humana',
      title: 'Analisar pedido',
      fields: { 'Papel responsável': 'Analista' },
    });
    await createFrom(page, {
      from: 'Saída de Analisar pedido',
      kind: 'Decisão exclusiva',
      title: 'Dados completos?',
    });

    await createFrom(page, {
      from: 'Ramo Não de Dados completos?',
      kind: 'Enviar mensagem',
      title: 'Pedir dados',
      fields: { Destinatário: 'Cliente' },
    });
    await createFrom(page, {
      from: 'Saída de Pedir dados',
      kind: 'Aguardar evento',
      title: 'Resposta',
      fields: { 'Evento aguardado': 'Resposta do cliente', Prazo: '48 horas' },
    });
    await connect(
      page,
      'Saída Evento recebido de Resposta',
      'Entrada de Retorno',
    );
    await createFrom(page, {
      from: 'Saída Prazo expirado de Resposta',
      kind: 'Fim',
      title: 'Expirou',
      fields: { Desfecho: 'Expirado' },
    });

    await createFrom(page, {
      from: 'Ramo Sim de Dados completos?',
      kind: 'Abertura paralela',
      title: 'Dividir',
    });
    await createFrom(page, {
      from: 'Ramo Caminho 1 de Dividir',
      kind: 'Tarefa automatizada',
      title: 'Registrar',
      fields: { Sistema: 'ERP' },
    });
    await properties(page)
      .getByRole('button', { name: 'Adicionar evento de exceção' })
      .click();
    await fill(page, 'Falha no registro');
    await createFrom(page, {
      from: 'Saída Erro técnico de Falha no registro',
      kind: 'Tarefa humana',
      title: 'Registrar à mão',
      fields: { 'Papel responsável': 'Suporte' },
    });
    await createFrom(page, {
      from: 'Saída de Registrar',
      kind: 'Convergência de alternativas',
      title: 'Registrado',
    });
    await connect(page, 'Saída de Registrar à mão', 'Entrada de Registrado');
    await createFrom(page, {
      from: 'Ramo Caminho 2 de Dividir',
      kind: 'Tarefa humana',
      title: 'Avisar cliente',
      fields: { 'Papel responsável': 'Atendimento' },
    });

    await createFrom(page, {
      from: 'Saída de Registrado',
      kind: 'Sincronização paralela',
      title: 'Juntar',
    });
    await expect(
      properties(page).getByLabel('Abertura correspondente'),
    ).toHaveValue(/.+/);
    await expect(properties(page)).toContainText(
      'Chegadas esperadas de Dividir',
    );
    await connect(page, 'Saída de Avisar cliente', 'Entrada de Juntar');
    await createFrom(page, {
      from: 'Saída de Juntar',
      kind: 'Tarefa humana',
      title: 'Concluir',
      fields: { 'Papel responsável': 'Analista' },
    });
    await createFrom(page, {
      from: 'Saída de Concluir',
      kind: 'Fim',
      title: 'Encerrado',
    });

    await expect(issueStatus(page)).toHaveText('Sem problemas');
    await expect(canvas(page).locator('.react-flow__node')).toHaveCount(16);

    await page.getByRole('button', { name: 'Layout automático' }).click();
    await expect(issueStatus(page)).toHaveText('Sem problemas');
  });
});
