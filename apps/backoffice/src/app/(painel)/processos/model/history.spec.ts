import {
  commit,
  commitSince,
  createHistory,
  HISTORY_LIMIT,
  redo,
  replacePresent,
  undo,
} from './history';

describe('histórico de desfazer e refazer', () => {
  it('grava o estado anterior a cada passo e desfaz na ordem inversa', () => {
    let history = createHistory('a');
    history = commit({ history, next: 'b' });
    history = commit({ history, next: 'c' });

    expect(history.past).toEqual(['a', 'b']);

    history = undo(history);
    expect(history.present).toBe('b');
    expect(history.future).toEqual(['c']);

    history = redo(history);
    expect(history.present).toBe('c');
    expect(history.future).toEqual([]);
  });

  it('não grava passo quando nada mudou', () => {
    const history = createHistory('a');

    expect(commit({ history, next: 'a' })).toBe(history);
    expect(replacePresent({ history, next: 'a' })).toBe(history);
    expect(commitSince({ history, before: 'a' })).toBe(history);
  });

  it('junta passos seguidos com a mesma chave', () => {
    let history = createHistory('');
    history = commit({ history, next: 'R', key: 'label:1' });
    history = commit({ history, next: 'Re', key: 'label:1' });
    history = commit({ history, next: 'Rev', key: 'label:1' });

    expect(history.past).toEqual(['']);

    history = commit({ history, next: 'Revisar', key: 'label:2' });
    expect(history.past).toEqual(['', 'Rev']);
  });

  it('apaga o futuro desfeito quando um passo novo é gravado', () => {
    let history = commit({ history: createHistory('a'), next: 'b' });
    history = undo(history);
    history = commit({ history, next: 'c' });

    expect(history.future).toEqual([]);
    expect(redo(history)).toBe(history);
  });

  it('não desfaz além do começo', () => {
    const history = createHistory('a');

    expect(undo(history)).toBe(history);
  });

  it('troca o atual sem passo e grava o arraste inteiro como um passo', () => {
    const before = createHistory({ x: 0 });
    let history = replacePresent({ history: before, next: { x: 5 } });
    history = replacePresent({ history, next: { x: 10 } });

    expect(history.past).toEqual([]);

    history = commitSince({ history, before: before.present });
    expect(history.past).toEqual([{ x: 0 }]);
    expect(history.present).toEqual({ x: 10 });
  });

  it(`guarda no máximo ${HISTORY_LIMIT} passos`, () => {
    let history = createHistory(0);
    for (let value = 1; value <= HISTORY_LIMIT + 5; value += 1) {
      history = commit({ history, next: value });
    }

    expect(history.past).toHaveLength(HISTORY_LIMIT);
    expect(history.past[0]).toBe(5);

    history = commitSince({ history, before: -1 });
    expect(history.past).toHaveLength(HISTORY_LIMIT);

    history = undo(history);
    history = redo(history);
    expect(history.past).toHaveLength(HISTORY_LIMIT);
  });
});
