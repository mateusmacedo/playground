import { expect, type Locator, type Page } from '@playwright/test';

import { savedCardTitles, withCard } from './support/board-documents';
import { addCard, cardTitles, openBoard } from './support/board-screen';
import { initialBoard } from './support/mock-samples';
import { test } from './support/mock-test';

const INITIAL_TODO = ['Item 1', 'Item 2', 'Item 3'];

function waiting(page: Page, label: string): Locator {
  return page.getByRole('status').filter({ hasText: label });
}

function notice(page: Page, text: string): Locator {
  return page.getByRole('alert').filter({ hasText: text });
}

/** O aviso de que o quadro mudou em outro lugar, com as duas saídas. */
function conflictNotice(page: Page): Locator {
  return notice(page, 'Este quadro foi alterado em outro lugar');
}

test.describe('quadro kanban: leitura pela API', () => {
  test('mostra a espera enquanto os quadros e o quadro aberto não chegam', async ({
    page,
    mockScenario,
  }) => {
    await mockScenario.start('slow');
    await page.goto('/quadro');

    await expect(waiting(page, 'Carregando os quadros…')).toBeVisible();
    await expect(waiting(page, 'Carregando o quadro…')).toBeVisible();

    await expect(cardTitles(page, 'A fazer')).toHaveText(INITIAL_TODO);
    await expect(waiting(page, 'Carregando')).toHaveCount(0);
  });

  test('avisa a falha da leitura e abre o quadro com Tentar de novo', async ({
    page,
    mockScenario,
  }) => {
    await mockScenario.start('error');
    await page.goto('/quadro');
    const failure = notice(page, 'Não foi possível carregar os quadros.');
    await expect(failure).toContainText(
      'O servidor encontrou um problema. Tente de novo em instantes.',
    );

    await mockScenario.stop();
    await failure.getByRole('button', { name: 'Tentar de novo' }).click();

    await expect(cardTitles(page, 'A fazer')).toHaveText(INITIAL_TODO);
    await expect(failure).toHaveCount(0);
  });
});

test.describe('quadro kanban: gravação pela API', () => {
  test('avisa a falha da gravação, mantém a mudança na tela e grava com Tentar de novo', async ({
    page,
    mock,
    mockScenario,
  }) => {
    await openBoard(page);
    await mockScenario.start('unavailable');
    await addCard({ page, laneName: 'Em andamento', title: 'Card pendente' });

    const failure = notice(
      page,
      'As últimas mudanças ainda não foram gravadas no servidor',
    );
    await expect(failure).toBeVisible();
    await expect(cardTitles(page, 'Em andamento')).toHaveText([
      'Item 4',
      'Card pendente',
    ]);
    expect(await savedCardTitles({ mock, laneTitle: 'Em andamento' })).toEqual([
      'Item 4',
    ]);

    await mockScenario.stop();
    await failure.getByRole('button', { name: 'Tentar de novo' }).click();

    await expect(failure).toHaveCount(0);
    await expect
      .poll(() => savedCardTitles({ mock, laneTitle: 'Em andamento' }))
      .toEqual(['Item 4', 'Card pendente']);
  });
});

test.describe('quadro kanban: conflito com outra gravação', () => {
  // NOTE: semear com a tela aberta é a gravação de outra pessoa: o servidor passa a uma revisão que a página não leu, e
  // a próxima gravação dela é recusada.
  test.beforeEach(async ({ page, mock }) => {
    await openBoard(page);
    await mock.seedBoard(
      withCard({
        seed: initialBoard(),
        laneId: 'done',
        title: 'Card de outra pessoa',
      }),
    );
    await addCard({ page, laneName: 'Em andamento', title: 'Meu card' });
    await expect(conflictNotice(page)).toBeVisible();
  });

  test('Recarregar do servidor traz a versão de lá e descarta a desta página', async ({
    page,
    mock,
  }) => {
    await conflictNotice(page)
      .getByRole('button', { name: 'Recarregar do servidor' })
      .click();

    await expect(conflictNotice(page)).toHaveCount(0);
    await expect(cardTitles(page, 'Concluído')).toHaveText([
      'Card de outra pessoa',
    ]);
    await expect(cardTitles(page, 'Em andamento')).toHaveText(['Item 4']);
    expect(await savedCardTitles({ mock, laneTitle: 'Em andamento' })).toEqual([
      'Item 4',
    ]);
  });

  test('Manter a minha versão grava o quadro desta página por cima', async ({
    page,
    mock,
  }) => {
    await conflictNotice(page)
      .getByRole('button', { name: 'Manter a minha versão' })
      .click();

    await expect(conflictNotice(page)).toHaveCount(0);
    await expect(cardTitles(page, 'Em andamento')).toHaveText([
      'Item 4',
      'Meu card',
    ]);
    await expect(cardTitles(page, 'Concluído')).toHaveCount(0);
    await expect
      .poll(() => savedCardTitles({ mock, laneTitle: 'Em andamento' }))
      .toEqual(['Item 4', 'Meu card']);
    expect(await savedCardTitles({ mock, laneTitle: 'Concluído' })).toEqual([]);
  });
});
