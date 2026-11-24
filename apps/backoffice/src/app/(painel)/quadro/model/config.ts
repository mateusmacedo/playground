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

/** Palavras do nome que começam por letra, sem acento e em maiúsculas. */
function prefixWords(name: string): readonly string[] {
  const withoutAccents = name.normalize('NFD').replace(/\p{Diacritic}/gu, '');
  const words = withoutAccents.toUpperCase().split(/[^A-Z0-9]+/);
  return words.filter((word) => /^[A-Z]/.test(word));
}

/** Sugestão de prefixo a partir do nome do quadro: as iniciais das palavras, ou as primeiras letras de uma palavra só. */
export function suggestKeyPrefix(name: string): string {
  const words = prefixWords(name);
  let prefix = (words[0] ?? '').slice(0, 3);
  if (words.length > 1) {
    prefix = words.map((word) => word.charAt(0)).join('');
  }
  const candidate = prefix.slice(0, 6);
  if (!isValidKeyPrefix(candidate)) {
    return DEFAULT_KEY_PREFIX;
  }
  return candidate;
}

export interface SetArchiveLaneHiddenParams {
  readonly config: BoardConfig;
  readonly hidden: boolean;
}

export function setArchiveLaneHidden(
  params: SetArchiveLaneHiddenParams,
): BoardConfig {
  return Boolean(params.config.archiveLaneHidden) === params.hidden
    ? params.config
    : { ...params.config, archiveLaneHidden: params.hidden || undefined };
}

export interface SetDoneLaneParams {
  readonly config: BoardConfig;
  readonly laneIds: readonly string[];
  readonly doneLaneId: string | undefined;
}

/** Define a coluna de conclusão; `undefined` tira, e coluna que não existe no quadro não muda nada. */
export function setDoneLane(params: SetDoneLaneParams): BoardConfig {
  const { config, laneIds, doneLaneId } = params;
  if (
    config.doneLaneId === doneLaneId ||
    (doneLaneId !== undefined && !laneIds.includes(doneLaneId))
  ) {
    return config;
  }
  return { ...config, doneLaneId };
}

export interface SetKeyPrefixParams {
  readonly config: BoardConfig;
  readonly keyPrefix: string;
}

export function setKeyPrefix(params: SetKeyPrefixParams): BoardConfig {
  const keyPrefix = normalizeKeyPrefix(params.keyPrefix);
  return isValidKeyPrefix(keyPrefix) && keyPrefix !== params.config.keyPrefix
    ? { ...params.config, keyPrefix }
    : params.config;
}
