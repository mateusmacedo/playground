import {
  ACTIVE_PROCESS_KEY,
  createSessionActiveProcessStore,
} from './active-process-store';

afterEach(() => {
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

describe('createSessionActiveProcessStore', () => {
  it('lembra o processo aberto por último nesta aba', () => {
    const store = createSessionActiveProcessStore();

    store.save('process-2');

    expect(store.load()).toBe('process-2');
    expect(window.sessionStorage.getItem(ACTIVE_PROCESS_KEY)).toBe('process-2');
  });

  it('não tem registro antes de abrir algum processo', () => {
    expect(createSessionActiveProcessStore().load()).toBeNull();
  });

  it('trata o armazenamento bloqueado como falta de registro', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('bloqueado', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('bloqueado', 'SecurityError');
    });
    const store = createSessionActiveProcessStore();

    expect(() => store.save('process-1')).not.toThrow();
    expect(store.load()).toBeNull();
  });
});
