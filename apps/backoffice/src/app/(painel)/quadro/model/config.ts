import type { BoardConfig } from './board';

/** Prefixo do código dos cards de um quadro que ainda não escolheu o dele. */
export const DEFAULT_KEY_PREFIX = 'QD';

const KEY_PREFIX_PATTERN = /^[A-Z][A-Z0-9]{0,5}$/;

export const DEFAULT_CONFIG: BoardConfig = { keyPrefix: DEFAULT_KEY_PREFIX };

/** Prefixo como fica gravado: sem espaços nas pontas e em maiúsculas. */
export function normalizeKeyPrefix(text: string): string {
  return text.trim().toUpperCase();
}

/** De 1 a 6 letras ou dígitos, começando por letra, para o código continuar curto e sem ambiguidade com o número. */
export function isValidKeyPrefix(prefix: string): boolean {
  return KEY_PREFIX_PATTERN.test(prefix);
}

/** Sugestão de prefixo a partir do nome do quadro: as iniciais das palavras, ou as primeiras letras de uma palavra só. */
export function suggestKeyPrefix(name: string): string {
  const words = name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter((word) => /^[A-Z]/.test(word));
  const prefix =
    words.length > 1
      ? words.map((word) => word[0]).join('')
      : (words[0] ?? '').slice(0, 3);
  const candidate = prefix.slice(0, 6);
  return isValidKeyPrefix(candidate) ? candidate : DEFAULT_KEY_PREFIX;
}

export function setKeyPrefix(params: {
  readonly config: BoardConfig;
  readonly keyPrefix: string;
}): BoardConfig {
  const keyPrefix = normalizeKeyPrefix(params.keyPrefix);
  return isValidKeyPrefix(keyPrefix) && keyPrefix !== params.config.keyPrefix
    ? { ...params.config, keyPrefix }
    : params.config;
}
