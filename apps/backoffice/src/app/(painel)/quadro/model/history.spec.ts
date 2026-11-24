import {
  dropCoalesced,
  HISTORY_LIMIT,
  isCoalescing,
  recordChange,
  redo,
  sealHistory,
  startHistory,
  undo,
} from './history';

describe('histórico de desfazer', () => {
  it('registra, desfaz e refaz na ordem', () => {
    let history = startHistory('a');
    history = recordChange({ history, next: 'b' });
    history = recordChange({ history, next: 'c' });

    history = undo(history);
    expect(history.present).toBe('b');
    history = undo(history);
    expect(history.present).toBe('a');
    expect(undo(history)).toBe(history);

    history = redo(history);
    expect(history.present).toBe('b');
    history = redo(history);
    expect(history.present).toBe('c');
    expect(redo(history)).toBe(history);
  });

  it('apaga o que havia para refazer quando registra algo novo', () => {
    let history = recordChange({ history: startHistory('a'), next: 'b' });
    history = undo(history);
    history = recordChange({ history, next: 'x' });
    expect(history.future).toEqual([]);
    expect(history.past).toEqual(['a']);
  });

  it('ignora registro igual ao estado atual', () => {
    const history = startHistory('a');
    expect(recordChange({ history, next: 'a' })).toBe(history);
  });

  it('junta registros seguidos com a mesma chave num passo só', () => {
    let history = startHistory('a');
    history = recordChange({ history, next: 'ab', key: 'título' });
    expect(isCoalescing({ history, key: 'título' })).toBe(true);
    history = recordChange({ history, next: 'abc', key: 'título' });
    expect(history.past).toEqual(['a']);

    history = recordChange({ history, next: 'abcd', key: 'outra' });
    expect(history.past).toEqual(['a', 'abc']);
    expect(isCoalescing({ history })).toBe(false);
  });

  it('fecha o passo com seal e descarta o passo em andamento com drop', () => {
    let history = recordChange({
      history: startHistory('a'),
      next: 'b',
      key: 'mover',
    });
    expect(sealHistory(sealHistory(history)).lastKey).toBeUndefined();
    history = recordChange({ history, next: 'c', key: 'mover' });
    expect(dropCoalesced(history)).toEqual({
      past: [],
      present: 'a',
      future: [],
    });
    expect(dropCoalesced(startHistory('a')).present).toBe('a');
  });

  it(`guarda no máximo ${HISTORY_LIMIT} passos`, () => {
    let history = startHistory(0);
    for (let step = 1; step <= HISTORY_LIMIT + 5; step += 1) {
      history = recordChange({ history, next: step });
    }
    expect(history.past).toHaveLength(HISTORY_LIMIT);
    expect(history.past[0]).toBe(5);
  });
});
