import type { ProcessCatalog } from './catalog';
import { copyName, nameRefusal } from './catalog-names';
import { testDefinition } from './catalog-test-data';

const catalog: ProcessCatalog = {
  definitions: [
    testDefinition(),
    testDefinition({ id: 'process-2', name: 'Cobrança' }),
    testDefinition({ id: 'process-3', name: 'Devolução', archived: true }),
  ],
};

describe('nameRefusal', () => {
  it('aceita um nome que nenhum processo usa', () => {
    expect(nameRefusal({ catalog, name: 'Compras' })).toBeUndefined();
  });

  it('recusa o nome vazio', () => {
    expect(nameRefusal({ catalog, name: '   ' })).toEqual({
      code: 'name-required',
      message: 'Informe o nome do processo.',
    });
  });

  it('recusa o nome de outro processo, sem diferenciar maiúsculas', () => {
    expect(nameRefusal({ catalog, name: ' cobrança ' })).toEqual({
      code: 'name-taken',
      message: 'Já existe um processo com este nome.',
    });
  });

  it('avisa quando o nome é de um processo arquivado', () => {
    expect(nameRefusal({ catalog, name: 'Devolução' })?.message).toBe(
      'Já existe um processo arquivado com este nome.',
    );
  });

  it('aceita o nome atual do processo que está sendo renomeado', () => {
    expect(
      nameRefusal({ catalog, name: 'COBRANÇA', definitionId: 'process-2' }),
    ).toBeUndefined();
  });
});

describe('copyName', () => {
  it('marca o nome como cópia', () => {
    expect(copyName({ catalog, name: 'Cobrança' })).toBe('Cobrança (cópia)');
  });

  it('numera a cópia quando as anteriores já estão no catálogo', () => {
    const withCopies: ProcessCatalog = {
      definitions: [
        ...catalog.definitions,
        testDefinition({ id: 'process-4', name: 'Cobrança (cópia)' }),
        testDefinition({ id: 'process-5', name: 'cobrança (CÓPIA 2)' }),
      ],
    };

    expect(copyName({ catalog: withCopies, name: 'Cobrança' })).toBe(
      'Cobrança (cópia 3)',
    );
  });
});
