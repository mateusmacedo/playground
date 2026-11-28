import {
  allValid,
  isCount,
  isFilledText,
  isPositiveInteger,
  isRecord,
  isTimestamp,
  keepValid,
  knownOption,
  optionalText,
} from './stored-values';

interface Item {
  readonly id: string;
}

function toItem(value: unknown): Item | null {
  return isRecord(value) && typeof value.id === 'string'
    ? { id: value.id }
    : null;
}

describe('isRecord', () => {
  it('aceita só objeto simples', () => {
    expect(isRecord({ a: 1 })).toBe(true);
    expect(isRecord(null)).toBe(false);
    expect(isRecord([1])).toBe(false);
    expect(isRecord('texto')).toBe(false);
  });
});

describe('isFilledText e optionalText', () => {
  it('aceitam texto com conteúdo', () => {
    expect(isFilledText(' a ')).toBe(true);
    expect(optionalText('a')).toBe('a');
  });

  it('recusam texto em branco e o que não é texto', () => {
    expect(isFilledText('  ')).toBe(false);
    expect(isFilledText(3)).toBe(false);
    expect(optionalText('')).toBeUndefined();
    expect(optionalText(null)).toBeUndefined();
  });
});

describe('isPositiveInteger e isCount', () => {
  it('separam o inteiro positivo da contagem que aceita zero', () => {
    expect(isPositiveInteger(1)).toBe(true);
    expect(isPositiveInteger(0)).toBe(false);
    expect(isCount(0)).toBe(true);
    expect(isCount(-1)).toBe(false);
  });

  it('recusam número quebrado e o que não é número', () => {
    expect(isPositiveInteger(1.5)).toBe(false);
    expect(isPositiveInteger('1')).toBe(false);
    expect(isCount(0.5)).toBe(false);
    expect(isCount('0')).toBe(false);
  });
});

describe('isTimestamp', () => {
  it('aceita o instante que o Date consegue ler', () => {
    expect(isTimestamp('2026-11-26T10:00:00.000Z')).toBe(true);
    expect(isTimestamp('2026-11-26T10:00')).toBe(true);
  });

  it('recusa texto que não é data e o que não é texto', () => {
    expect(isTimestamp('agora')).toBe(false);
    expect(isTimestamp(1764151200000)).toBe(false);
  });
});

describe('knownOption', () => {
  const options = ['a', 'b'] as const;

  it('devolve o valor quando ele é uma das opções', () => {
    expect(knownOption({ value: 'b', options })).toBe('b');
  });

  it('devolve undefined para o valor de fora', () => {
    expect(knownOption({ value: 'c', options })).toBeUndefined();
    expect(knownOption({ value: 1, options })).toBeUndefined();
  });
});

describe('keepValid', () => {
  it('mantém os itens legíveis e descarta os estragados', () => {
    const items = keepValid({
      value: [{ id: 'a' }, 'lixo', { id: 'b' }],
      parse: toItem,
    });
    expect(items).toEqual([{ id: 'a' }, { id: 'b' }]);
  });

  it('devolve undefined quando não é lista ou não sobra item', () => {
    expect(keepValid({ value: 'lixo', parse: toItem })).toBeUndefined();
    expect(keepValid({ value: ['lixo'], parse: toItem })).toBeUndefined();
  });
});

describe('allValid', () => {
  it('devolve a lista quando todo item é legível e tem id único', () => {
    const items = allValid({
      value: [{ id: 'a' }, { id: 'b' }],
      parse: toItem,
    });
    expect(items).toEqual([{ id: 'a' }, { id: 'b' }]);
  });

  it('aceita a lista vazia', () => {
    expect(allValid({ value: [], parse: toItem })).toEqual([]);
  });

  it('invalida a lista inteira com um item estragado', () => {
    expect(
      allValid({ value: [{ id: 'a' }, 'lixo'], parse: toItem }),
    ).toBeNull();
  });

  it('invalida a lista inteira com id repetido', () => {
    expect(
      allValid({ value: [{ id: 'a' }, { id: 'a' }], parse: toItem }),
    ).toBeNull();
  });

  it('invalida o que não é lista', () => {
    expect(allValid({ value: undefined, parse: toItem })).toBeNull();
  });
});
