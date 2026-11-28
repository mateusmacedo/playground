import { configureBoard } from './board-settings';
import { processBoard } from './process-test-data';
import { BOARD_RULES, cleanRules, setRules } from './rules';

describe('cleanRules', () => {
  it('guarda só as regras ligadas', () => {
    expect(
      cleanRules({ parentWaitsChildren: true, doneWaitsProcess: false }),
    ).toEqual({ parentWaitsChildren: true });
    expect(cleanRules({})).toBeUndefined();
    expect(cleanRules(undefined)).toBeUndefined();
  });

  it('conhece as seis regras do quadro', () => {
    const all = Object.fromEntries(BOARD_RULES.map((rule) => [rule, true]));
    expect(Object.keys(cleanRules(all) ?? {})).toHaveLength(6);
  });
});

describe('setRules', () => {
  const config = processBoard({ rules: { doneWaitsProcess: true } }).config;

  it('troca o conjunto inteiro das regras', () => {
    expect(setRules({ config, rules: { childInherits: true } }).rules).toEqual({
      childInherits: true,
    });
    expect(setRules({ config, rules: {} }).rules).toBeUndefined();
  });

  it('devolve a própria configuração com as mesmas regras', () => {
    expect(
      setRules({
        config,
        rules: { doneWaitsProcess: true, parentWaitsChildren: false },
      }),
    ).toBe(config);
  });
});

describe('configureBoard com regras', () => {
  it('grava as regras na configuração do quadro', () => {
    const board = processBoard();
    const next = configureBoard({
      board,
      rules: { processEndMovesCard: true },
    });
    expect(next.config.rules).toEqual({ processEndMovesCard: true });
  });

  it('mantém o quadro quando as regras não mudam ou não vêm', () => {
    const board = processBoard({ rules: { processEndMovesCard: true } });
    expect(
      configureBoard({ board, rules: { processEndMovesCard: true } }),
    ).toBe(board);
    expect(configureBoard({ board })).toBe(board);
  });
});
