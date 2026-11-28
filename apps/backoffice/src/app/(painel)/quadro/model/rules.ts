import type { BoardConfig, BoardRules } from './board';

export type BoardRule = keyof BoardRules;

/** As regras do quadro, na ordem em que a configuração as mostra. */
export const BOARD_RULES: readonly BoardRule[] = [
  'parentWaitsChildren',
  'parentFollowsChildren',
  'doneWaitsProcess',
  'processEndMovesCard',
  'doneWaitsBlockers',
  'childInherits',
];

/** Regras como chegam: as do quadro ou um objeto lido do armazenamento, ainda sem formato garantido. */
export type LooseRules = BoardRules | Readonly<Record<string, unknown>>;

/** Só as regras ligadas, como ficam gravadas; o que não for `true` fica desligado, e sem nenhuma volta `undefined`. */
export function cleanRules(
  rules: LooseRules | undefined,
): BoardRules | undefined {
  const on: Partial<Record<BoardRule, true>> = {};
  for (const rule of BOARD_RULES) {
    if (rules?.[rule] === true) {
      on[rule] = true;
    }
  }
  return Object.keys(on).length > 0 ? on : undefined;
}

function sameRules(
  a: BoardRules | undefined,
  b: BoardRules | undefined,
): boolean {
  return BOARD_RULES.every((rule) => Boolean(a?.[rule]) === Boolean(b?.[rule]));
}

export interface SetRulesParams {
  readonly config: BoardConfig;
  /** O conjunto inteiro: a regra ausente fica desligada. */
  readonly rules: BoardRules;
}

/** Troca as regras do quadro; as mesmas regras devolvem o próprio `config`. */
export function setRules(params: SetRulesParams): BoardConfig {
  const { config, rules } = params;
  if (sameRules(config.rules, rules)) {
    return config;
  }
  return { ...config, rules: cleanRules(rules) };
}
