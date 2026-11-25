import { expect, type Locator, type Page, test } from '@playwright/test';

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
