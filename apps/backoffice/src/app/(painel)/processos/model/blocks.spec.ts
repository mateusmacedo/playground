import {
  acceptsExceptions,
  BLOCK_CATEGORIES,
  BLOCK_SPECS,
  blockName,
  hasBranches,
  isBlockKind,
  kindOf,
  specOf,
} from './blocks';

describe('catálogo de blocos', () => {
  it('lista os dezessete blocos na ordem da biblioteca', () => {
    expect(BLOCK_SPECS.map((spec) => spec.label)).toEqual([
      'Início',
      'Aguardar evento',
      'Temporizador',
      'Evento de exceção',
      'Fim',
      'Etapa',
      'Tarefa humana',
      'Tarefa automatizada',
      'Enviar mensagem',
      'Subprocesso',
      'Decisão exclusiva',
      'Convergência de alternativas',
      'Decisão inclusiva',
      'Junção inclusiva',
      'Abertura paralela',
      'Sincronização paralela',
      'Anotação',
    ]);
  });

  it('põe todo bloco num grupo da biblioteca', () => {
    const categories = BLOCK_CATEGORIES.map((entry) => entry.category);

    for (const spec of BLOCK_SPECS) {
      expect(categories).toContain(spec.category);
    }
  });

  it('reconhece só os tipos do catálogo', () => {
    expect(isBlockKind('parallel-join')).toBe(true);
    expect(isBlockKind('toString')).toBe(false);
    expect(isBlockKind(42)).toBe(false);
  });

  it('trata nó sem tipo conhecido como Etapa', () => {
    expect(kindOf({ type: 'merge' })).toBe('merge');
    expect(kindOf({ type: 'outro' })).toBe('task');
    expect(kindOf({})).toBe('task');
  });

  it('descreve a cardinalidade de entrada e saída de cada tipo', () => {
    expect(specOf('start')).toMatchObject({ input: 'none', output: 'single' });
    expect(specOf('human-task')).toMatchObject({
      input: 'one',
      output: 'single',
    });
    expect(specOf('wait-event')).toMatchObject({
      input: 'one',
      output: 'events',
    });
    expect(specOf('parallel-join')).toMatchObject({
      input: 'many',
      output: 'single',
    });
    expect(specOf('exception')).toMatchObject({
      input: 'none',
      output: 'single',
    });
    expect(specOf('end')).toMatchObject({ input: 'many', output: 'none' });
    expect(specOf('annotation')).toMatchObject({
      input: 'none',
      output: 'none',
    });
  });

  it('separa os tipos com ramos e os que aceitam exceção', () => {
    expect(hasBranches('inclusive-split')).toBe(true);
    expect(hasBranches('merge')).toBe(false);
    expect(acceptsExceptions('automated-task')).toBe(true);
    expect(acceptsExceptions('task')).toBe(false);
  });

  it('usa o nome do tipo quando o título está vazio', () => {
    expect(blockName({ type: 'timer', data: { label: '  ' } })).toBe(
      'Temporizador',
    );
    expect(blockName({ type: 'timer', data: { label: 'Esperar' } })).toBe(
      'Esperar',
    );
  });
});
