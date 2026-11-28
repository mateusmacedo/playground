import { act, fireEvent, render, screen, within } from '@testing-library/react';

import type { PanelApi } from '@/shared/api/panel-api';
import { PanelApiProvider } from '@/shared/api/panel-api-context';
import { fakeDefinitionsApi } from '@/shared/process/definitions-api-fake';
import { linearPlan } from '@/shared/process/engine-test-plans';

import { BoardWorkspace } from './board-workspace';
import type { Board } from './model/board';
import { sampleLabels, sampleLanes } from './model/sample-board';
import { activeStep, boardRunning, processSection } from './process-test-kit';
import {
  createFakeBoardsApi,
  type FakeBoardsApi,
  storedDocument,
} from './store/boards-api-test-kit';
import { openCard } from './stored-board-test-kit';
import { RUN_NOT_SAVED } from './use-run-diagram';

/** Espera padrão entre a mudança do quadro e o envio. */
const WRITE_DELAY = 400;
const WAITING_TEXT = 'Gravando o quadro antes de abrir…';
const NOT_SAVED_NOTICE =
  /As últimas mudanças ainda não foram gravadas no servidor/;
const CONFLICT_NOTICE = /Este quadro foi alterado em outro lugar/;

/** O que o navegador faria com cada clique num link, na ordem: `true` quando seguiria o endereço. */
let followed: boolean[] = [];

function recordLinkClick(event: MouseEvent): void {
  if (!(event.target instanceof Element) || !event.target.closest('a')) {
    return;
  }
  followed.push(!event.defaultPrevented);
  // NOTE: o jsdom não navega e reclama quando tentam; o clique é segurado aqui, depois de a tela já ter decidido.
  event.preventDefault();
}

interface ServerRevision {
  readonly api: FakeBoardsApi;
  readonly revision: number;
}

/** Põe no servidor o quadro principal, com o card `c1` (Card c1) no começo do processo em linha. */
function putRunningBoard(params: ServerRevision): void {
  const { api, revision } = params;
  api.documents.set(
    'board-1',
    storedDocument({
      id: 'board-1',
      name: 'Principal',
      revision,
      board: boardRunning(linearPlan),
    }),
  );
}

/** Avança o relógio simulado e deixa o React aplicar o que as chamadas à API mudaram. */
async function advance(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

/** Abre o quadro que vem do servidor e, nele, o card `c1`, com a seção "Processo" já lida. */
async function openRunningCard(): Promise<FakeBoardsApi> {
  const api = createFakeBoardsApi();
  putRunningBoard({ api, revision: 1 });
  const panelApi: PanelApi = {
    boards: api,
    processDefinitions: fakeDefinitionsApi(),
  };
  render(
    <PanelApiProvider value={panelApi}>
      <BoardWorkspace sampleLanes={sampleLanes} sampleLabels={sampleLabels} />
    </PanelApiProvider>,
  );
  await advance(0);
  openCard('Card c1');
  await advance(0);
  return api;
}

function completeStepA(): void {
  fireEvent.click(
    within(activeStep('a')).getByRole('button', { name: 'Concluir etapa' }),
  );
}

function diagramLink(): HTMLElement {
  return within(processSection()).getByRole('link', { name: 'Ver diagrama' });
}

/** Etapas que o servidor tem como resolvidas na execução do card `c1`. */
function serverStepsDone(api: FakeBoardsApi): readonly string[] {
  const board = api.documents.get('board-1')?.board as Board | undefined;
  const run = board?.lanes[0]?.cards[0]?.process;
  const steps = run?.log.filter((event) => event.kind === 'step') ?? [];
  return steps.map((event) => event.label);
}

function leavePage(): boolean {
  const leaving = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(leaving);
  return leaving.defaultPrevented;
}

describe('KanbanBoard com a API ligada: diagrama do processo', () => {
  beforeEach(() => {
    followed = [];
    localStorage.clear();
    window.history.replaceState(null, '', '/quadro');
    document.addEventListener('click', recordLinkClick);
    vi.useFakeTimers();
  });

  afterEach(() => {
    document.removeEventListener('click', recordLinkClick);
    vi.useRealTimers();
    localStorage.clear();
  });

  it('aponta o diagrama para o quadro e o card que o servidor conhece', async () => {
    await openRunningCard();

    const address = new URL((diagramLink() as HTMLAnchorElement).href);

    expect(address.searchParams.get('ref')).toBe('board-1:c1');
  });

  it('espera a etapa concluída chegar ao servidor antes de abrir o diagrama', async () => {
    const api = await openRunningCard();
    completeStepA();
    const release = api.holdNext();

    fireEvent.click(diagramLink());
    await advance(0);

    expect(followed).toEqual([false]);
    expect(api.calls.at(-1)).toBe('PUT /boards/board-1');
    expect(serverStepsDone(api)).toEqual([]);
    expect(within(processSection()).getByText(WAITING_TEXT)).toBeTruthy();

    release();
    await advance(0);

    expect(serverStepsDone(api)).toEqual(['a']);
    expect(followed).toEqual([false, true]);
    expect(within(processSection()).queryByText(WAITING_TEXT)).toBeNull();
  });

  it('abre o diagrama sem chamar o servidor quando não há nada por gravar', async () => {
    const api = await openRunningCard();
    const callsBefore = api.calls.length;

    fireEvent.click(diagramLink());
    await advance(0);

    expect(followed).toEqual([false, true]);
    expect(api.calls).toHaveLength(callsBefore);
  });

  it('não abre o diagrama quando a gravação falha, e o link aponta o aviso do quadro', async () => {
    const api = await openRunningCard();
    api.failNext('network');
    completeStepA();

    fireEvent.click(diagramLink());
    await advance(0);

    expect(followed).toEqual([false]);
    expect(within(processSection()).getByRole('alert').textContent).toBe(
      RUN_NOT_SAVED,
    );
    expect(screen.getByText(NOT_SAVED_NOTICE)).toBeTruthy();
  });

  it('depois da nova tentativa de gravação dar certo, abre o diagrama', async () => {
    const api = await openRunningCard();
    api.failNext('network');
    completeStepA();
    fireEvent.click(diagramLink());
    await advance(0);
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    await advance(0);

    fireEvent.click(diagramLink());
    await advance(0);

    expect(serverStepsDone(api)).toEqual(['a']);
    expect(followed).toEqual([false, false, true]);
    expect(within(processSection()).queryByRole('alert')).toBeNull();
  });

  it('não abre o diagrama quando o quadro foi alterado em outro lugar', async () => {
    const api = await openRunningCard();
    putRunningBoard({ api, revision: 2 });
    completeStepA();

    fireEvent.click(diagramLink());
    await advance(0);

    expect(followed).toEqual([false]);
    expect(within(processSection()).getByRole('alert').textContent).toBe(
      RUN_NOT_SAVED,
    );
    expect(screen.getByText(CONFLICT_NOTICE)).toBeTruthy();
  });

  it('avisa ao sair da página enquanto a etapa concluída não chegou ao servidor', async () => {
    await openRunningCard();
    expect(leavePage()).toBe(false);

    completeStepA();
    expect(leavePage()).toBe(true);

    await advance(WRITE_DELAY);
    expect(leavePage()).toBe(false);
  });
});
