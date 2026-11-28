import { block, decisionBranches, link } from '../model/test-graph';
import { type ProcessGraph, toProcessGraph } from '../process-graph';
import { RUN_EDGE_TYPE, runEdges, runNodes } from './run-graph';
import type { RunMark } from './run-marks';

const yes = link({ source: 'choice', target: 'review', sourceHandle: 'yes' });
const no = link({ source: 'choice', target: 'done', sourceHandle: 'no' });

const graph: ProcessGraph = toProcessGraph({
  nodes: [
    block({
      id: 'choice',
      type: 'decision',
      data: { label: 'Aprovado?', branches: decisionBranches },
    }),
    block({ id: 'review', type: 'task', data: { label: 'Analisar' } }),
    block({ id: 'done', type: 'end', data: { label: 'Fim' } }),
  ],
  edges: [yes, no],
});

describe('runNodes', () => {
  it('diz o estado da etapa no nome do bloco e dá a ele a moldura da marca', () => {
    const marks = new Map<string, RunMark>([['review', 'active']]);

    const nodes = runNodes({ nodes: graph.nodes, marks });

    expect(nodes.find((node) => node.id === 'review')).toMatchObject({
      ariaLabel: 'Etapa: Analisar, etapa atual',
      className: 'process-run-node process-run-node--active',
      domAttributes: { 'aria-roledescription': 'bloco' },
    });
  });

  it.each<[RunMark, string]>([
    ['waiting', 'Etapa: Analisar, em espera'],
    ['done', 'Etapa: Analisar, concluída'],
    ['raised', 'Etapa: Analisar, exceção acionada'],
  ])('nomeia a marca %s', (mark, ariaLabel) => {
    const nodes = runNodes({
      nodes: graph.nodes,
      marks: new Map([['review', mark]]),
    });

    expect(nodes.find((node) => node.id === 'review')?.ariaLabel).toBe(
      ariaLabel,
    );
  });

  it('deixa o bloco sem marca como no editor', () => {
    const nodes = runNodes({ nodes: graph.nodes, marks: new Map() });

    const review = nodes.find((node) => node.id === 'review');
    expect(review?.ariaLabel).toBe('Etapa: Analisar');
    expect(review?.className).toBeUndefined();
  });
});

describe('runEdges', () => {
  it('desenha toda conexão com o tipo do diagrama, sem o botão de inserir do editor', () => {
    const edges = runEdges({ graph, takenEdges: new Set() });

    expect(edges.map((edge) => edge.type)).toEqual([
      RUN_EDGE_TYPE,
      RUN_EDGE_TYPE,
    ]);
  });

  it('diz no nome da conexão que a execução passou por ela e reforça o traço', () => {
    const edges = runEdges({ graph, takenEdges: new Set([yes.id]) });

    expect(edges.find((edge) => edge.id === yes.id)).toMatchObject({
      ariaLabel: 'Conexão de Aprovado? para Analisar, Sim, caminho percorrido',
      className: 'process-run-edge--taken',
      domAttributes: { 'aria-roledescription': 'conexão' },
    });
  });

  it('deixa a conexão não percorrida como no editor', () => {
    const edges = runEdges({ graph, takenEdges: new Set([yes.id]) });

    const other = edges.find((edge) => edge.id === no.id);
    expect(other?.ariaLabel).toBe('Conexão de Aprovado? para Fim, Não');
    expect(other?.className).toBeUndefined();
  });
});
