import { createBrowserDraftStore } from './draft-store';

describe('createBrowserDraftStore', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('grava e lê o rascunho na chave dele', async () => {
    const store = createBrowserDraftStore('teste:rascunho');

    await store.save('texto');

    expect(store.load()).toBe('texto');
    expect(window.localStorage.getItem('teste:rascunho')).toBe('texto');
  });

  it('rejeita a gravação recusada pelo navegador', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('cheio', 'QuotaExceededError');
    });

    await expect(createBrowserDraftStore().save('x')).rejects.toThrow('cheio');
  });

  it('trata armazenamento bloqueado como sem rascunho', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('bloqueado', 'SecurityError');
    });

    expect(createBrowserDraftStore().load()).toBeNull();
  });
});
