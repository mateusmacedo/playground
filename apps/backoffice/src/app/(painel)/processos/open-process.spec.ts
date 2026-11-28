import { testDefinition } from '@/shared/process/catalog-test-data';

import {
  liveDefinitions,
  neighborDefinition,
  openDefinition,
  resolveAddressRequest,
} from './open-process';

const first = testDefinition({ id: 'process-1', name: 'Atendimento' });
const second = testDefinition({ id: 'process-2', name: 'Compras' });
const third = testDefinition({ id: 'process-3', name: 'Entrega' });
const archived = testDefinition({
  id: 'process-4',
  name: 'Antigo',
  archived: true,
});
const catalog = { definitions: [first, archived, second, third] };
const live = [first, second, third];

describe('liveDefinitions', () => {
  it('deixa de fora os arquivados e mantém a ordem', () => {
    expect(liveDefinitions(catalog)).toEqual(live);
  });
});

describe('resolveAddressRequest', () => {
  it('não pede nada sem processo no endereço', () => {
    expect(resolveAddressRequest({ catalog, requestedId: null })).toEqual({});
  });

  it('abre o processo pedido que existe e está ativo', () => {
    expect(
      resolveAddressRequest({ catalog, requestedId: 'process-2' }),
    ).toEqual({ definitionId: 'process-2' });
  });

  it('avisa quando o processo pedido não existe', () => {
    const request = resolveAddressRequest({
      catalog,
      requestedId: 'process-9',
    });

    expect(request.definitionId).toBeUndefined();
    expect(request.notice).toMatch(/não existe neste navegador/);
  });

  it('diz no aviso onde os processos ficam guardados', () => {
    const request = resolveAddressRequest({
      catalog,
      requestedId: 'process-9',
      place: 'no servidor',
    });

    expect(request.notice).toBe(
      'O processo pedido no endereço não existe no servidor. Outro processo foi aberto no lugar.',
    );
  });

  it('avisa quando o processo pedido está arquivado', () => {
    const request = resolveAddressRequest({
      catalog,
      requestedId: 'process-4',
    });

    expect(request.notice).toBe(
      'O processo Antigo está arquivado. Restaure-o em "Arquivados" para abrir.',
    );
  });
});

describe('openDefinition', () => {
  it('abre o primeiro candidato que é de um processo ativo', () => {
    const opened = openDefinition({
      live,
      candidates: [undefined, 'process-4', 'process-3', 'process-2'],
    });

    expect(opened).toBe(third);
  });

  it('abre o primeiro da lista sem candidato válido', () => {
    expect(openDefinition({ live, candidates: [null] })).toBe(first);
  });

  it('não abre nada sem processo ativo', () => {
    expect(openDefinition({ live: [], candidates: [] })).toBeUndefined();
  });
});

describe('neighborDefinition', () => {
  it('passa para o seguinte da lista', () => {
    expect(neighborDefinition({ live, definitionId: 'process-2' })).toBe(third);
  });

  it('volta para o anterior no fim da lista', () => {
    expect(neighborDefinition({ live, definitionId: 'process-3' })).toBe(
      second,
    );
  });

  it('não tem vizinho quando o processo é o único ou não está na lista', () => {
    expect(
      neighborDefinition({ live: [first], definitionId: 'process-1' }),
    ).toBeUndefined();
    expect(
      neighborDefinition({ live, definitionId: 'process-9' }),
    ).toBeUndefined();
  });
});
