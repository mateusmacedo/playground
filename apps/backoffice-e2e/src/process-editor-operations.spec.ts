import { expect, type Locator, type Page, test } from '@playwright/test';

import { dragBetween } from './flow-drag';

test.use({ viewport: { width: 1600, height: 1000 } });

function canvas(page: Page): Locator {
  return page.getByLabel('Canvas do processo');
}

function nodes(page: Page): Locator {
  return canvas(page).locator('.react-flow__node');
}

function properties(page: Page): Locator {
  return page.getByRole('region', { name: 'Propriedades' });
}

function draftStatus(page: Page): Locator {
  return page
    .getByRole('status')
    .filter({ hasText: /ascunho|Alterações|Salvando/ });
}

function timerNode(page: Page): Locator {
  return canvas(page).getByText('Temporizador', { exact: true });
}

async function openEditor(page: Page) {
  await page.goto('/processos');
  await expect(canvas(page).getByText('Primeira etapa')).toBeVisible();
}

async function selectNode(page: Page, text: string) {
  await nodes(page).filter({ hasText: text }).first().click();
}

// WHY: script em texto porque o tsconfig do e2e não carrega os tipos do DOM; ele roda no navegador antes da página.
const FAIL_FIRST_DRAFT_SAVE = `
  (() => {
    let failNext = true;
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'playground:processos:draft:v1' && failNext) {
        failNext = false;
        throw new DOMException('cota cheia', 'QuotaExceededError');
      }
      return original.call(this, key, value);
    };
  })();
`;

test.describe('editor de processos: rascunho', () => {
  test('salva fluxo incompleto, tenta de novo após falha e reabre igual', async ({
    page,
  }) => {
    await page.addInitScript(FAIL_FIRST_DRAFT_SAVE);
    await openEditor(page);
    await expect(draftStatus(page)).toHaveText('Rascunho ainda não salvo.');

    await page.getByRole('button', { name: 'Inserir Temporizador' }).click();
    await page.getByRole('button', { name: 'Salvar rascunho' }).click();
    await expect(draftStatus(page)).toHaveText(
      'Falha ao salvar o rascunho. A edição continua aqui.',
    );
    await expect(timerNode(page)).toBeVisible();

    await page.getByRole('button', { name: 'Tentar novamente' }).click();
    await expect(draftStatus(page)).toHaveText(
      'Rascunho salvo neste navegador.',
    );

    await page.reload();
    await expect(timerNode(page)).toBeVisible();
    await expect(nodes(page)).toHaveCount(4);
    await expect(draftStatus(page)).toHaveText(
      'Rascunho salvo neste navegador.',
    );
  });
});

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

function edge(page: Page, name: string): Locator {
  return canvas(page).getByRole('group', { name, exact: true });
}

async function selectWithOthers(page: Page, texts: readonly string[]) {
  const [first, ...rest] = texts;
  await selectNode(page, first ?? '');
  for (const text of rest) {
    await nodes(page)
      .filter({ hasText: text })
      .first()
      .click({ modifiers: ['ControlOrMeta'] });
  }
}

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
      page
        .getByRole('toolbar', { name: 'Ações do editor' })
        .getByRole('button', { name, exact: true });
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
    await expect(
      page
        .getByRole('toolbar', { name: 'Ações do editor' })
        .getByRole('status'),
    ).toHaveText('3 problemas');
  });
});

function port(page: Page, label: string): Locator {
  return page.getByLabel(label, { exact: true });
}
