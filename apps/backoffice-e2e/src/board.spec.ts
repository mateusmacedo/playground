import { expect, type Locator, type Page, test } from '@playwright/test';

function lane(page: Page, name: string): Locator {
  return page.getByRole('region', { name });
}

function cardTitles(page: Page, laneName: string): Locator {
  return lane(page, laneName).getByRole('heading', { level: 3 });
}

/** Posição e tamanho do elemento na tela; falha se ele não estiver visível. */
async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error('O elemento não está visível.');
  }
  return box;
}

test.describe('quadro kanban', () => {
  test('abre pelo menu lateral com título e colunas', async ({ page }) => {
    await page.goto('/');
    await page
      .getByRole('navigation', { name: 'Menu lateral', exact: true })
      .getByRole('link', { name: 'Quadro' })
      .click();

    await expect(page).toHaveTitle(/^Quadro · .+/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Quadro' }),
    ).toBeVisible();
    await expect(page.getByLabel('breadcrumb')).toContainText('Quadro');
    await expect(page.getByRole('main').getByRole('region')).toHaveCount(3);
  });

  test('arrasta um card para a coluna vazia', async ({ page }) => {
    await page.goto('/quadro');
    const card = page
      .getByRole('listitem')
      .filter({ has: page.getByRole('heading', { name: 'Item 1' }) });
    const target = lane(page, 'Concluído');

    // WHY: o HTML chega antes da hidratação e um arraste nesse intervalo não move nada, então repete até mover.
    // Repetir é seguro: soltar o card no fim da coluna em que ele já está não muda o quadro.
    await expect(async () => {
      await card.dragTo(target);
      await expect(cardTitles(page, 'Concluído')).toHaveText(['Item 1'], {
        timeout: 1000,
      });
    }).toPass();
    await expect(cardTitles(page, 'A fazer')).toHaveText(['Item 2', 'Item 3']);
  });

  test('move um card pelo teclado e solta com Espaço', async ({ page }) => {
    await page.goto('/quadro');
    const handle = page.getByRole('button', { name: 'Mover Item 2' });

    // WHY: mesmo motivo da hidratação; a checagem do `aria-pressed` impede que uma repetição solte o card já pego.
    await expect(async () => {
      if ((await handle.getAttribute('aria-pressed')) !== 'true') {
        await handle.click();
      }
      await expect(handle).toHaveAttribute('aria-pressed', 'true', {
        timeout: 1000,
      });
    }).toPass();

    await handle.focus();
    await page.keyboard.press('ArrowRight');
    await expect(cardTitles(page, 'Em andamento')).toHaveText([
      'Item 4',
      'Item 2',
    ]);
    await expect(handle).toBeFocused();

    await page.keyboard.press('Space');
    await expect(handle).toHaveAttribute('aria-pressed', 'false');
    await expect(cardTitles(page, 'A fazer')).toHaveText(['Item 1', 'Item 3']);
  });

  test('cria uma coluna, renomeia e muda a posição dela pelo teclado', async ({
    page,
  }) => {
    await page.goto('/quadro');
    const addLane = page.getByRole('button', { name: 'Adicionar coluna' });
    const name = page.getByRole('textbox', { name: 'Nome da nova coluna' });

    // WHY: antes da hidratação o botão não abre o campo; repete o clique até o campo aparecer.
    await expect(async () => {
      if (await addLane.isVisible()) {
        await addLane.click();
      }
      await expect(name).toBeVisible({ timeout: 1000 });
    }).toPass();
    await name.fill('Revisão');
    await name.press('Enter');
    await expect(lane(page, 'Revisão')).toBeVisible();

    await page.getByRole('button', { name: 'Ações da coluna Revisão' }).click();
    await page.getByRole('button', { name: 'Renomear' }).click();
    const rename = page.getByRole('textbox', { name: 'Nome da coluna' });
    await rename.fill('Homologação');
    await rename.press('Enter');

    const handle = page.getByRole('button', {
      name: 'Mover a coluna Homologação',
    });
    await handle.click();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Space');
    await expect(
      page.getByRole('main').getByRole('heading', { level: 2 }),
    ).toHaveText(['A fazer', 'Em andamento', 'Homologação', 'Concluído']);
  });

  test('abre o card pelo clique, edita o título e define o card pai', async ({
    page,
  }) => {
    await page.goto('/quadro');
    const open = page.getByRole('button', { name: 'Item 4', exact: true });
    const details = page.getByRole('dialog', { name: 'Detalhes do card' });

    // WHY: mesmo motivo da hidratação; o clique só abre o painel depois dela.
    await expect(async () => {
      if (!(await details.isVisible())) {
        await open.click();
      }
      await expect(details).toBeVisible({ timeout: 1000 });
    }).toPass();
    await expect(details).toBeFocused();

    await details.getByLabel('Título').fill('Item 4 revisado');
    await details
      .getByLabel('Card pai')
      .selectOption({ label: 'Item 1 (A fazer)' });
    const card = page
      .getByRole('listitem')
      .filter({ has: page.getByRole('heading', { name: 'Item 4 revisado' }) });
    await expect(card).toContainText('Filho de Item 1');

    await page.keyboard.press('Escape');
    await expect(details).toBeHidden();
    await expect(
      card.getByRole('button', { name: 'Item 4 revisado', exact: true }),
    ).toBeFocused();
  });

  test('mantém o quadro depois de recarregar a página', async ({ page }) => {
    await page.goto('/quadro');
    const doing = lane(page, 'Em andamento');
    const addCard = doing.getByRole('button', { name: 'Adicionar card' });
    const title = doing.getByRole('textbox', {
      name: 'Título do novo card em Em andamento',
    });

    await expect(async () => {
      if (await addCard.isVisible()) {
        await addCard.click();
      }
      await expect(title).toBeVisible({ timeout: 1000 });
    }).toPass();
    await title.fill('Card gravado');
    await title.press('Enter');
    await expect(cardTitles(page, 'Em andamento')).toHaveText([
      'Item 4',
      'Card gravado',
    ]);

    await page.reload();
    await expect(cardTitles(page, 'Em andamento')).toHaveText([
      'Item 4',
      'Card gravado',
    ]);
  });
});

test.describe('quadro kanban em monitor grande', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test('ocupa a largura e a altura da janela, e a coluna cheia rola por dentro', async ({
    page,
  }) => {
    const cards = Array.from({ length: 30 }, (_, index) => ({
      id: `card-${index + 1}`,
      title: `Card ${index + 1}`,
    }));
    await page.addInitScript(
      (lanes) => {
        localStorage.setItem(
          'backoffice:quadro:v1',
          JSON.stringify({ version: 1, lanes }),
        );
      },
      [
        { id: 'todo', title: 'A fazer', cards },
        { id: 'done', title: 'Concluído', cards: [] },
      ],
    );
    await page.goto('/quadro');
    const full = lane(page, 'A fazer');
    await expect(cardTitles(page, 'A fazer')).toHaveCount(30);

    const main = await boxOf(page.getByRole('main'));
    const footer = await boxOf(page.getByRole('contentinfo'));
    const fullBox = await boxOf(full);
    const emptyBox = await boxOf(lane(page, 'Concluído'));

    // NOTE: sem o limite de largura do layout, a primeira coluna começa junto da borda do conteúdo e passa dos 288 px
    // mínimos; a coluna vazia estica até perto do rodapé.
    expect(fullBox.x - main.x).toBeLessThan(80);
    expect(fullBox.width).toBeGreaterThan(400);
    expect(footer.y - (emptyBox.y + emptyBox.height)).toBeLessThan(80);

    // NOTE: com 30 cards, uma página que crescesse com o conteúdo empurraria o rodapé para fora da janela.
    await expect(page.getByRole('contentinfo')).toBeInViewport();
    await expect(
      full.getByRole('button', { name: 'Adicionar card' }),
    ).toBeInViewport();
    await expect(
      full.getByRole('heading', { name: 'Card 30' }),
    ).not.toBeInViewport();
  });
});

test.describe('quadro kanban em tela estreita', () => {
  test.use({ viewport: { width: 800, height: 900 } });

  test('mantém as colunas na largura mínima, com rolagem horizontal', async ({
    page,
  }) => {
    await page.goto('/quadro');
    const first = await boxOf(lane(page, 'A fazer'));
    const last = await boxOf(lane(page, 'Concluído'));

    expect(first.width).toBe(288);
    expect(last.x + last.width).toBeGreaterThan(800);
  });
});

test.describe('quadro kanban: busca, desfazer, arquivo e dados do card', () => {
  /** Abre o card pelo clique, repetindo enquanto a página ainda não hidratou. */
  async function openCard(page: Page, title: string) {
    const details = page.getByRole('dialog', { name: 'Detalhes do card' });
    await expect(async () => {
      if (!(await details.isVisible())) {
        await page.getByRole('button', { name: title, exact: true }).click();
      }
      await expect(details).toBeVisible({ timeout: 1000 });
    }).toPass();
    return details;
  }

  function card(page: Page, title: string): Locator {
    return page
      .getByRole('listitem')
      .filter({ has: page.getByRole('heading', { name: title, exact: true }) });
  }

  test('a busca esmaece os cards que não batem e a barra leva até ela', async ({
    page,
  }) => {
    await page.goto('/quadro');
    const search = page.getByRole('searchbox', { name: 'Buscar cards' });
    await expect(async () => {
      await page.locator('body').press('/');
      await expect(search).toBeFocused({ timeout: 1000 });
    }).toPass();

    await page.keyboard.type('qd-4');
    await expect(page.getByText('1 de 4 cards')).toBeVisible();
    await expect(card(page, 'Item 1')).toHaveClass(/kanban-card--dimmed/);
    await expect(card(page, 'Item 4')).not.toHaveClass(/kanban-card--dimmed/);
  });

  test('desfaz o arraste com Ctrl+Z e refaz com Ctrl+Shift+Z', async ({
    page,
  }) => {
    await page.goto('/quadro');
    await expect(async () => {
      await card(page, 'Item 4').dragTo(lane(page, 'Concluído'));
      await expect(cardTitles(page, 'Concluído')).toHaveText(['Item 4'], {
        timeout: 1000,
      });
    }).toPass();

    await page.locator('body').press('Control+z');
    await expect(cardTitles(page, 'Em andamento')).toHaveText(['Item 4']);
    await page.locator('body').press('Control+Shift+z');
    await expect(cardTitles(page, 'Concluído')).toHaveText(['Item 4']);
  });

  test('arquiva o card pelo painel e restaura pela lista de arquivados', async ({
    page,
  }) => {
    await page.goto('/quadro');
    const details = await openCard(page, 'Item 4');
    await details.getByRole('button', { name: 'Arquivar card' }).click();
    await expect(cardTitles(page, 'Em andamento')).toHaveCount(0);

    await page.getByRole('button', { name: 'Arquivados (1)' }).click();
    const list = page.getByRole('dialog', { name: 'Cards arquivados' });
    await list.getByRole('button', { name: 'Restaurar Item 4' }).click();
    await list.getByRole('button', { name: 'Fechar', exact: true }).click();
    await expect(cardTitles(page, 'Em andamento')).toHaveText(['Item 4']);
  });

  test('abre o card pelo endereço e marca etiqueta e checklist', async ({
    page,
  }) => {
    await page.goto('/quadro?card=QD-1');
    const details = page.getByRole('dialog', { name: 'Detalhes do card' });
    await expect(details.getByLabel('Título')).toHaveValue('Item 1');

    await details
      .getByRole('group', { name: 'Etiquetas' })
      .getByRole('checkbox', { name: 'Urgente' })
      .check();
    await details.getByRole('checkbox', { name: 'Segundo passo' }).check();
    await expect(card(page, 'Item 1')).toContainText('Urgente');
    await expect(card(page, 'Item 1')).toContainText(
      'Checklist: 2 de 2 itens feitos',
    );

    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /^Etiquetas/ }).click();
    await page
      .locator('.kanban-label-filter')
      .getByRole('checkbox', { name: 'Urgente' })
      .check();
    await expect(card(page, 'Item 2')).toHaveClass(/kanban-card--dimmed/);
    await expect(card(page, 'Item 4')).not.toHaveClass(/kanban-card--dimmed/);
  });
});
