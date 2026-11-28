import type { StepState } from '@/shared/process/engine-states';
import { type ExitKey, exitKey, type StepRef } from '@/shared/process/plan';

import type { Graph, GraphEdge, GraphNode } from '../model/blocks';
import { block, decisionBranches, link } from '../model/test-graph';
import {
  type LevelRun,
  levelScope,
  nodeMarks,
  takenEdgeIds,
} from './run-marks';

interface LevelParams {
  readonly nodes: readonly GraphNode[];
  readonly edges?: readonly GraphEdge[];
  readonly scope?: StepRef;
  readonly states?: Readonly<Record<StepRef, StepState>>;
  readonly taken?: readonly ExitKey[];
}

/** Nível de teste: os blocos e conexões dados e o que a execução diz deles. */
function levelOf(params: LevelParams): LevelRun {
  const { nodes, edges = [], scope, states = {}, taken = [] } = params;
  const graph: Graph = { nodes, edges };
  return {
    graph,
    scope,
    states: new Map(Object.entries(states)),
    takenExits: new Set(taken),
  };
}

interface ExceptionOnParams {
  readonly id: string;
  /** Etapa a que o Evento de exceção está preso. */
  readonly parentId: string;
}

function exceptionOn(params: ExceptionOnParams): GraphNode {
  const { id, parentId } = params;
  return { ...block({ id, type: 'exception' }), parentId };
}

describe('levelScope', () => {
  it('não tem endereço no processo principal', () => {
    expect(levelScope([])).toBeUndefined();
  });

  it('é o endereço do subprocesso aberto', () => {
    expect(levelScope(['billing'])).toBe('billing');
  });

  it('junta os subprocessos abertos um dentro do outro', () => {
    expect(levelScope(['billing', 'charge'])).toBe('billing/charge');
  });
});

describe('nodeMarks', () => {
  it('dá a cada bloco o estado da etapa dele', () => {
    const level = levelOf({
      nodes: [
        block({ id: 'review', type: 'task' }),
        block({ id: 'sign', type: 'approval' }),
        block({ id: 'join', type: 'parallel-join' }),
      ],
      states: { review: 'done', sign: 'active', join: 'waiting' },
    });

    expect([...nodeMarks(level)]).toEqual([
      ['review', 'done'],
      ['sign', 'active'],
      ['join', 'waiting'],
    ]);
  });

  it('deixa sem marca o bloco que a execução ainda não alcançou', () => {
    const level = levelOf({
      nodes: [block({ id: 'review', type: 'task' })],
    });

    expect(nodeMarks(level).size).toBe(0);
  });

  it('lê o estado no endereço do subprocesso aberto', () => {
    const level = levelOf({
      nodes: [block({ id: 'check', type: 'task' })],
      scope: 'billing',
      states: { check: 'done', 'billing/check': 'active' },
    });

    expect(nodeMarks(level).get('check')).toBe('active');
  });

  it('nunca marca a anotação, que não é etapa', () => {
    const level = levelOf({
      nodes: [block({ id: 'note', type: 'annotation' })],
      states: { note: 'done' },
    });

    expect(nodeMarks(level).has('note')).toBe(false);
  });

  it('marca como acionado o Evento de exceção por onde a execução desviou', () => {
    const level = levelOf({
      nodes: [
        block({ id: 'review', type: 'task' }),
        exceptionOn({ id: 'late', parentId: 'review' }),
      ],
      taken: [exitKey({ stepRef: 'review', exitId: 'late' })],
    });

    expect(nodeMarks(level).get('late')).toBe('raised');
  });

  it('procura o desvio da exceção no endereço do subprocesso aberto', () => {
    const level = levelOf({
      nodes: [
        block({ id: 'check', type: 'task' }),
        exceptionOn({ id: 'late', parentId: 'check' }),
      ],
      scope: 'billing',
      taken: [exitKey({ stepRef: 'billing/check', exitId: 'late' })],
    });

    expect(nodeMarks(level).get('late')).toBe('raised');
  });

  it('deixa sem marca o Evento de exceção que não aconteceu', () => {
    const level = levelOf({
      nodes: [
        block({ id: 'review', type: 'task' }),
        exceptionOn({ id: 'late', parentId: 'review' }),
      ],
      states: { late: 'done' },
    });

    expect(nodeMarks(level).has('late')).toBe(false);
  });

  it('deixa sem marca o Evento de exceção solto, que não desvia etapa nenhuma', () => {
    const level = levelOf({
      nodes: [block({ id: 'late', type: 'exception' })],
      taken: [exitKey({ stepRef: 'late', exitId: 'late' })],
    });

    expect(nodeMarks(level).has('late')).toBe(false);
  });
});

describe('takenEdgeIds', () => {
  const review = block({ id: 'review', type: 'task' });
  const done = block({ id: 'done', type: 'end' });

  it('marca a conexão da saída que a execução percorreu', () => {
    const edge = link({ source: 'review', target: 'done' });
    const level = levelOf({
      nodes: [review, done],
      edges: [edge],
      taken: [exitKey({ stepRef: 'review', exitId: 'out' })],
    });

    expect([...takenEdgeIds(level)]).toEqual([edge.id]);
  });

  it('não marca a conexão da saída que a execução não percorreu', () => {
    const level = levelOf({
      nodes: [review, done],
      edges: [link({ source: 'review', target: 'done' })],
    });

    expect(takenEdgeIds(level).size).toBe(0);
  });

  it('marca só o ramo escolhido de uma decisão', () => {
    const decision = block({
      id: 'decision',
      type: 'decision',
      data: { branches: decisionBranches },
    });
    const yes = link({
      source: 'decision',
      target: 'review',
      sourceHandle: 'yes',
    });
    const no = link({ source: 'decision', target: 'done', sourceHandle: 'no' });
    const level = levelOf({
      nodes: [decision, review, done],
      edges: [yes, no],
      taken: [exitKey({ stepRef: 'decision', exitId: 'yes' })],
    });

    expect([...takenEdgeIds(level)]).toEqual([yes.id]);
  });

  it('conta a conexão sem ponto de saída como a saída única', () => {
    const edge: GraphEdge = { id: 'plain', source: 'review', target: 'done' };
    const level = levelOf({
      nodes: [review, done],
      edges: [edge],
      taken: [exitKey({ stepRef: 'review', exitId: 'out' })],
    });

    expect(takenEdgeIds(level).has('plain')).toBe(true);
  });

  it('lê a saída no endereço do subprocesso aberto', () => {
    const edge = link({ source: 'review', target: 'done' });
    const level = levelOf({
      nodes: [review, done],
      edges: [edge],
      scope: 'billing',
      taken: [exitKey({ stepRef: 'billing/review', exitId: 'out' })],
    });

    expect(takenEdgeIds(level).has(edge.id)).toBe(true);
  });

  it('marca a conexão que sai do Evento de exceção pelo desvio da etapa a que ele está preso', () => {
    const edge = link({ source: 'late', target: 'done' });
    const level = levelOf({
      nodes: [review, exceptionOn({ id: 'late', parentId: 'review' }), done],
      edges: [edge],
      taken: [exitKey({ stepRef: 'review', exitId: 'late' })],
    });

    expect([...takenEdgeIds(level)]).toEqual([edge.id]);
  });

  it('não marca a conexão que sai de um Evento de exceção solto', () => {
    const level = levelOf({
      nodes: [block({ id: 'late', type: 'exception' }), done],
      edges: [link({ source: 'late', target: 'done' })],
      taken: [exitKey({ stepRef: 'late', exitId: 'out' })],
    });

    expect(takenEdgeIds(level).size).toBe(0);
  });

  it('não marca a conexão cuja origem não existe mais', () => {
    const level = levelOf({
      nodes: [done],
      edges: [link({ source: 'gone', target: 'done' })],
      taken: [exitKey({ stepRef: 'gone', exitId: 'out' })],
    });

    expect(takenEdgeIds(level).size).toBe(0);
  });
});
