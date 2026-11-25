import {
  BLOCK_SPECS,
  createBlock,
  isBlockKind,
  kindOf,
  outputHandles,
  specOf,
} from './blocks';
import { block, decisionBranches } from './test-graph';

describe('catálogo de blocos', () => {
  it('lista os seis blocos na ordem da biblioteca', () => {
    expect(BLOCK_SPECS.map((spec) => spec.label)).toEqual([
      'Início',
      'Etapa',
      'Decisão',
      'Convergência',
      'Fim',
      'Anotação',
    ]);
  });

  it('reconhece só os tipos do catálogo', () => {
    expect(isBlockKind('decision')).toBe(true);
    expect(isBlockKind('toString')).toBe(false);
    expect(isBlockKind(42)).toBe(false);
  });

  it('trata nó sem tipo conhecido como Etapa', () => {
    expect(kindOf({ type: 'merge' })).toBe('merge');
    expect(kindOf({ type: 'outro' })).toBe('task');
    expect(kindOf({})).toBe('task');
  });

  it('descreve entradas e saídas de cada tipo', () => {
    expect(specOf('start')).toMatchObject({ input: 'none', output: 'single' });
    expect(specOf('merge')).toMatchObject({ input: 'many', output: 'single' });
    expect(specOf('annotation')).toMatchObject({
      input: 'none',
      output: 'none',
    });
  });
});

describe('outputHandles', () => {
  it('dá a saída única, um ponto por ramo ou nenhum', () => {
    expect(outputHandles(block('t', 'task'))).toEqual(['out']);
    expect(
      outputHandles(block('d', 'decision', { branches: decisionBranches })),
    ).toEqual(['yes', 'no']);
    expect(outputHandles(block('d', 'decision'))).toEqual([]);
    expect(outputHandles(block('e', 'end'))).toEqual([]);
  });
});

describe('createBlock', () => {
  function sequentialIds() {
    let next = 0;
    return () => {
      next += 1;
      return `id-${next}`;
    };
  }

  it('cria o bloco com o nome do tipo na posição pedida', () => {
    const node = createBlock({
      kind: 'task',
      position: { x: 10, y: 20 },
      createId: sequentialIds(),
    });

    expect(node).toEqual({
      id: 'id-1',
      type: 'task',
      position: { x: 10, y: 20 },
      data: { label: 'Etapa' },
    });
  });

  it('cria a Decisão com os ramos Sim e Não', () => {
    const node = createBlock({
      kind: 'decision',
      position: { x: 0, y: 0 },
      createId: sequentialIds(),
    });

    expect(node.data.branches).toEqual([
      { id: 'id-1', label: 'Sim' },
      { id: 'id-2', label: 'Não' },
    ]);
    expect(node.id).toBe('id-3');
  });
});
