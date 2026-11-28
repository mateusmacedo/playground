import { readRequestedProcess, writeProcessAddress } from './process-address';

afterEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/');
});

describe('readRequestedProcess', () => {
  it('lê o processo pedido no endereço', () => {
    window.history.replaceState(null, '', '/processos?processo=process-3');

    expect(readRequestedProcess()).toBe('process-3');
  });

  it('não pede nada sem o parâmetro ou com ele vazio', () => {
    window.history.replaceState(null, '', '/processos');
    expect(readRequestedProcess()).toBeNull();

    window.history.replaceState(null, '', '/processos?processo=');
    expect(readRequestedProcess()).toBeNull();
  });
});

describe('writeProcessAddress', () => {
  it('põe o processo aberto no endereço, mantendo os outros parâmetros', () => {
    window.history.replaceState(null, '', '/processos?aba=1#topo');

    writeProcessAddress('process-2');

    expect(window.location.search).toBe('?aba=1&processo=process-2');
    expect(window.location.hash).toBe('#topo');
  });

  it('não regrava o endereço que já aponta o processo', () => {
    window.history.replaceState(null, '', '/processos?processo=process-2');
    const replace = vi.spyOn(window.history, 'replaceState');

    writeProcessAddress('process-2');

    expect(replace).not.toHaveBeenCalled();
  });
});
