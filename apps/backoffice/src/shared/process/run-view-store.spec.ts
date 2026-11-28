import { begin } from './engine-test-kit';
import { linearPlan } from './engine-test-plans';
import {
  BOARD_HREF,
  createBrowserRunViewStore,
  parseRunViewRef,
  RUN_VIEW_LIMIT,
  RUN_VIEW_STORAGE_KEY,
  type RunView,
  runViewRef,
} from './run-view-store';

const KEY = 'teste:execucoes';

const run = begin(linearPlan);

/** Situação de teste; `overrides` troca só o que o teste precisa. */
function viewOf(overrides: Partial<RunView> = {}): RunView {
  return {
    ref: 'board-1:card-1',
    definitionId: run.definitionId,
    version: run.version,
    processName: 'Atendimento',
    cardLabel: 'QD-1 Atender o pedido',
    backHref: '/quadro?card=QD-1',
    run,
    savedAt: '2026-11-26T12:00:00.000Z',
    ...overrides,
  };
}

/** Grava direto no armazenamento o que outra versão do painel, ou alguém, poderia ter deixado lá. */
function storeRaw(views: unknown): void {
  window.localStorage.setItem(KEY, JSON.stringify({ version: 1, views }));
}

describe('runViewRef', () => {
  it('junta o id do quadro e o id do card', () => {
    expect(runViewRef({ boardId: 'board-1', cardId: 'card-7' })).toBe(
      'board-1:card-7',
    );
  });
});

describe('createBrowserRunViewStore', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('grava a situação e a lê pela referência', () => {
    const store = createBrowserRunViewStore(KEY);
    const view = viewOf();

    const saved = store.save(view);

    expect(saved).toBe(true);
    expect(store.load(view.ref)).toEqual(view);
  });

  it('usa a chave das execuções do painel quando nenhuma é informada', () => {
    createBrowserRunViewStore().save(viewOf());

    expect(RUN_VIEW_STORAGE_KEY).toBe('backoffice:processos:execucoes:v1');
    expect(window.localStorage.getItem(RUN_VIEW_STORAGE_KEY)).not.toBeNull();
  });

  it('não lê nada enquanto a execução não tem situação gravada', () => {
    const store = createBrowserRunViewStore(KEY);
    store.save(viewOf());

    expect(store.load('board-1:card-2')).toBeNull();
  });

  it('troca a situação anterior da mesma execução pela nova', () => {
    const store = createBrowserRunViewStore(KEY);
    store.save(viewOf({ cardLabel: 'QD-1 Título antigo' }));

    store.save(viewOf({ cardLabel: 'QD-1 Título novo' }));

    expect(store.load('board-1:card-1')?.cardLabel).toBe('QD-1 Título novo');
    const stored = JSON.parse(window.localStorage.getItem(KEY) ?? '{}');
    expect(stored.views).toHaveLength(1);
  });

  it('guarda só as situações mais recentes, até o limite', () => {
    const store = createBrowserRunViewStore(KEY);

    for (let number = 0; number <= RUN_VIEW_LIMIT; number++) {
      store.save(viewOf({ ref: `board-1:card-${number}` }));
    }

    expect(RUN_VIEW_LIMIT).toBe(20);
    expect(store.load('board-1:card-0')).toBeNull();
    expect(store.load('board-1:card-1')).not.toBeNull();
    expect(store.load(`board-1:card-${RUN_VIEW_LIMIT}`)).not.toBeNull();
  });

  it.each([
    ['texto que não é JSON', '{quebrado'],
    ['valor que não é objeto', '[]'],
    ['formato de outra versão', JSON.stringify({ version: 2, views: [] })],
    ['situações fora de lista', JSON.stringify({ version: 1, views: {} })],
  ])('trata %s como sem situação gravada', (_case, raw) => {
    window.localStorage.setItem(KEY, raw);

    expect(createBrowserRunViewStore(KEY).load('board-1:card-1')).toBeNull();
  });

  it.each([
    ['que não é objeto', 'texto solto'],
    ['sem referência', { ...viewOf(), ref: ' ' }],
    ['sem processo', { ...viewOf(), definitionId: '' }],
    ['com versão inválida', { ...viewOf(), version: 0 }],
    ['sem nome do processo', { ...viewOf(), processName: ' ' }],
    ['sem o card', { ...viewOf(), cardLabel: 7 }],
    ['sem a hora', { ...viewOf(), savedAt: 'ontem' }],
    ['com a execução ilegível', { ...viewOf(), run: { status: 'running' } }],
    ['com a execução de outro processo', { ...viewOf(), definitionId: 'x' }],
    ['com a execução de outra versão', { ...viewOf(), version: 2 }],
  ])('descarta a situação %s e mantém as outras', (_case, broken) => {
    const kept = viewOf({ ref: 'board-1:card-2' });
    storeRaw([broken, kept]);
    const store = createBrowserRunViewStore(KEY);

    expect(store.load('board-1:card-1')).toBeNull();
    expect(store.load('board-1:card-2')).toEqual(kept);
  });

  it('mantém o endereço de volta que aponta para dentro do painel', () => {
    storeRaw([viewOf({ backHref: '/quadro?card=QD-9' })]);

    const view = createBrowserRunViewStore(KEY).load('board-1:card-1');

    expect(view?.backHref).toBe('/quadro?card=QD-9');
  });

  it.each([
    ['de outro site', 'https://exemplo.test/quadro'],
    ['sem o protocolo', '//exemplo.test/quadro'],
    ['com barra invertida', '/\\exemplo.test'],
    ['que executa código', 'javascript:alert(1)'],
    ['que não é texto', 42],
  ])('troca o endereço de volta %s pelo do quadro', (_case, backHref) => {
    storeRaw([{ ...viewOf(), backHref }]);

    const view = createBrowserRunViewStore(KEY).load('board-1:card-1');

    expect(BOARD_HREF).toBe('/quadro');
    expect(view?.backHref).toBe(BOARD_HREF);
  });

  it('trata armazenamento bloqueado como sem situação gravada', () => {
    createBrowserRunViewStore(KEY).save(viewOf());
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('bloqueado', 'SecurityError');
    });

    expect(createBrowserRunViewStore(KEY).load('board-1:card-1')).toBeNull();
  });

  it('devolve false quando o navegador recusa a gravação', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('cheio', 'QuotaExceededError');
    });

    const saved = createBrowserRunViewStore(KEY).save(viewOf());

    expect(saved).toBe(false);
  });
});

describe('parseRunViewRef', () => {
  it('separa o id do quadro e o id do card', () => {
    expect(parseRunViewRef('board-1:card-7')).toEqual({
      boardId: 'board-1',
      cardId: 'card-7',
    });
  });

  it('é o inverso da referência que o quadro monta', () => {
    const ref = runViewRef({ boardId: 'board-2', cardId: 'card:com:pontos' });

    expect(parseRunViewRef(ref)).toEqual({
      boardId: 'board-2',
      cardId: 'card:com:pontos',
    });
  });

  it.each([
    ['sem referência', null],
    ['vazia', ''],
    ['sem o separador', 'board-1'],
    ['sem o quadro', ':card-1'],
    ['sem o card', 'board-1:'],
  ])('não lê a referência %s', (_case, ref) => {
    expect(parseRunViewRef(ref)).toBeNull();
  });
});
