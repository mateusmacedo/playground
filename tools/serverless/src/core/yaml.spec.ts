import { describe, expect, it } from 'vitest';

import {
  getObject,
  getString,
  hasKey,
  isPlainObject,
  parseYamlObject,
} from './yaml.js';

describe('parseYamlObject', () => {
  it('devolve o objeto do documento e aceita as tags do CloudFormation', () => {
    expect(parseYamlObject('a: 1\nref: !Ref Recurso\n')).toMatchObject({
      a: 1,
    });
  });

  it('devolve null para sintaxe inválida', () => {
    expect(parseYamlObject('a: [aberto')).toBeNull();
  });

  it.each(['- um\n- dois\n', 'texto solto\n', ''])(
    'devolve null quando a raiz do documento não é um mapa: %j',
    (raw) => {
      expect(parseYamlObject(raw)).toBeNull();
    },
  );
});

describe('leitores de YAML', () => {
  const value = { texto: 'a', mapa: { chave: 1 }, lista: [1], nulo: null };

  it('getObject só devolve mapas', () => {
    expect(getObject(value, 'mapa')).toEqual({ chave: 1 });
    expect(getObject(value, 'texto')).toBeUndefined();
    expect(getObject(value, 'lista')).toBeUndefined();
    expect(getObject(value, 'nulo')).toBeUndefined();
    expect(getObject('não é mapa', 'mapa')).toBeUndefined();
  });

  it('getString só devolve textos', () => {
    expect(getString(value, 'texto')).toBe('a');
    expect(getString(value, 'mapa')).toBeUndefined();
    expect(getString(null, 'texto')).toBeUndefined();
  });

  it('hasKey vale para a chave própria, mesmo com valor vazio', () => {
    expect(hasKey(value, 'nulo')).toBe(true);
    expect(hasKey(value, 'toString')).toBe(false);
    expect(hasKey([], 'length')).toBe(false);
  });

  it('isPlainObject recusa listas e null', () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject([])).toBe(false);
    expect(isPlainObject(null)).toBe(false);
  });
});
