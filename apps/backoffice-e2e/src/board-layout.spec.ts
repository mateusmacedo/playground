import { expect } from '@playwright/test';

import { boardOf } from './support/board-documents';
import { cardTitles, lane, openBoard } from './support/board-screen';
import { boxOf } from './support/box';
import { test } from './support/mock-test';

const FULL_LANE_CARDS = 30;

test.describe('quadro kanban em monitor grande', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test('ocupa a largura e a altura da janela, e a coluna cheia rola por dentro', async ({
    page,
    mock,
  }) => {
    const titles = Array.from(
      { length: FULL_LANE_CARDS },
      (_, index) => `Card ${index + 1}`,
    );
    await mock.seedBoard(
      boardOf({
        lanes: [
          { id: 'todo', title: 'A fazer', cards: titles },
          { id: 'done', title: 'Concluído', cards: [] },
        ],
      }),
    );
    await openBoard(page);
    const full = lane(page, 'A fazer');
    await expect(cardTitles(page, 'A fazer')).toHaveCount(FULL_LANE_CARDS);

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
    await openBoard(page);
    const first = await boxOf(lane(page, 'A fazer'));
    const last = await boxOf(lane(page, 'Concluído'));

    expect(first.width).toBe(288);
    expect(last.x + last.width).toBeGreaterThan(800);
  });
});
