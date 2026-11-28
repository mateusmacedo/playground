import { parseRunViewRef } from '@/shared/process/run-view-store';

import { RUNS_HREF, runDiagramHref } from './run-links';
import { REF_PARAM } from './use-run-view';

describe('runDiagramHref', () => {
  it('aponta para a página das execuções com a referência do quadro e do card', () => {
    expect(runDiagramHref({ boardId: 'board-1', cardId: 'card-7' })).toBe(
      '/processos/execucao?ref=board-1:card-7',
    );
  });

  it('codifica o que poderia quebrar o endereço, e a página lê a referência de volta', () => {
    const ref = { boardId: 'quadro 2&x', cardId: 'card#7:a' };

    const href = runDiagramHref(ref);
    const address = new URL(href, 'http://painel.test');

    expect(address.pathname).toBe(RUNS_HREF);
    expect(parseRunViewRef(address.searchParams.get(REF_PARAM))).toEqual(ref);
  });
});
