import {
  createBlock,
  nextBranchLabel,
  suggestedBranchLabel,
} from './block-factory';
import { sequentialIds } from './test-graph';

describe('createBlock', () => {
  it('cria o bloco com o nome do tipo na posição pedida', () => {
    const node = createBlock({
      kind: 'task',
      position: { x: 10, y: 20 },
      createId: sequentialIds('id'),
    });

    expect(node).toEqual({
      id: 'id-1',
      type: 'task',
      position: { x: 10, y: 20 },
      data: { label: 'Etapa' },
    });
  });

  it('cria a Decisão exclusiva com os ramos Sim e Não', () => {
    const node = createBlock({
      kind: 'decision',
      position: { x: 0, y: 0 },
      createId: sequentialIds('id'),
    });

    expect(node.data.branches).toEqual([
      { id: 'id-1', label: 'Sim' },
      { id: 'id-2', label: 'Não' },
    ]);
    expect(node.id).toBe('id-3');
  });

  it('cria as aberturas com dois caminhos numerados', () => {
    const node = createBlock({
      kind: 'parallel-split',
      position: { x: 0, y: 0 },
      createId: sequentialIds('id'),
    });

    expect(node.data.branches?.map((branch) => branch.label)).toEqual([
      'Caminho 1',
      'Caminho 2',
    ]);
  });

  it('cria a Aprovação só com o nome do tipo', () => {
    const node = createBlock({
      kind: 'approval',
      position: { x: 0, y: 0 },
      createId: sequentialIds('id'),
    });

    expect(node).toMatchObject({
      type: 'approval',
      data: { label: 'Aprovação' },
    });
  });

  it('dá os padrões de início, fim, temporizador e exceção', () => {
    const createId = sequentialIds('id');
    const at = { x: 0, y: 0 };

    expect(createBlock({ kind: 'start', position: at, createId }).data).toEqual(
      { label: 'Início', trigger: 'manual' },
    );
    expect(createBlock({ kind: 'end', position: at, createId }).data).toEqual({
      label: 'Fim',
      outcome: 'completed',
    });
    expect(createBlock({ kind: 'timer', position: at, createId }).data).toEqual(
      {
        label: 'Temporizador',
        timerMode: 'duration',
        duration: { amount: 1, unit: 'hours' },
      },
    );
    expect(
      createBlock({ kind: 'exception', position: at, createId }).data,
    ).toEqual({
      label: 'Evento de exceção',
      exceptionTrigger: 'error',
      interrupting: true,
    });
  });

  it('cria o subprocesso com um canvas interno de Início ligado ao Fim', () => {
    const node = createBlock({
      kind: 'subprocess',
      position: { x: 0, y: 0 },
      createId: sequentialIds('id'),
    });
    const process = node.data.process;

    expect(process?.nodes.map((inner) => inner.type)).toEqual(['start', 'end']);
    expect(process?.edges).toEqual([
      {
        id: 'id-3',
        source: 'id-1',
        target: 'id-2',
        sourceHandle: 'out',
        targetHandle: 'in',
      },
    ]);
  });
});

describe('nextBranchLabel', () => {
  it('numera o ramo novo pela quantidade de ramos mais um', () => {
    const branches = [
      { id: 'a', label: suggestedBranchLabel(1) },
      { id: 'b', label: suggestedBranchLabel(2) },
    ];

    expect(nextBranchLabel(branches)).toBe('Caminho 3');
    expect(nextBranchLabel([])).toBe('Caminho 1');
  });

  it('pula o número que outro ramo já usa depois de uma remoção', () => {
    const branches = [
      { id: 'a', label: 'Caminho 1' },
      { id: 'c', label: 'Caminho 3' },
    ];

    expect(nextBranchLabel(branches)).toBe('Caminho 4');
  });

  it('compara o nome como a validação: sem espaços nas pontas e sem diferença de maiúsculas', () => {
    const branches = [
      { id: 'a', label: 'Sim' },
      { id: 'b', label: '  caminho 3 ' },
    ];

    expect(nextBranchLabel(branches)).toBe('Caminho 4');
  });
});
