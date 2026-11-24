import {
  DEFAULT_CONFIG,
  isValidKeyPrefix,
  normalizeKeyPrefix,
  setKeyPrefix,
  suggestKeyPrefix,
} from './config';

describe('configuração do quadro', () => {
  it('normaliza e valida o prefixo do código', () => {
    expect(normalizeKeyPrefix(' ops ')).toBe('OPS');
    expect(isValidKeyPrefix('OPS')).toBe(true);
    expect(isValidKeyPrefix('A1')).toBe(true);
    expect(isValidKeyPrefix('')).toBe(false);
    expect(isValidKeyPrefix('1A')).toBe(false);
    expect(isValidKeyPrefix('ABCDEFG')).toBe(false);
    expect(isValidKeyPrefix('A-B')).toBe(false);
  });

  it('sugere o prefixo pelas iniciais ou pelo começo do nome', () => {
    expect(suggestKeyPrefix('Operações de TI')).toBe('ODT');
    expect(suggestKeyPrefix('Jurídico')).toBe('JUR');
    expect(suggestKeyPrefix('')).toBe('QD');
    expect(suggestKeyPrefix('123')).toBe('QD');
  });

  it('troca o prefixo só quando o novo é válido e diferente', () => {
    const changed = setKeyPrefix({ config: DEFAULT_CONFIG, keyPrefix: 'ops' });
    expect(changed).toEqual({ keyPrefix: 'OPS' });
    expect(setKeyPrefix({ config: DEFAULT_CONFIG, keyPrefix: 'qd' })).toBe(
      DEFAULT_CONFIG,
    );
    expect(setKeyPrefix({ config: DEFAULT_CONFIG, keyPrefix: '9' })).toBe(
      DEFAULT_CONFIG,
    );
  });
});
