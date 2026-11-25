import { fireEvent, render, screen, within } from '@testing-library/react';

import type { Graph } from '../model/blocks';
import { LANE_WIDTH } from '../model/document';
import type { ProcessIssue } from '../model/issues';
import { block, decisionBranches } from '../model/test-graph';
import { type ProcessNode, toProcessGraph } from '../process-graph';
import { BlockProperties } from './block-properties';
import type { PanelCommands } from './panel-commands';

function commandsMock() {
  return {
    updateBlock: vi.fn(),
    addBranch: vi.fn(),
    renameBranch: vi.fn(),
    updateBranch: vi.fn(),
    removeBranch: vi.fn(),
    updateEdgeLabel: vi.fn(),
    duplicateSelected: vi.fn(),
    deleteSelected: vi.fn(),
    convert: vi.fn(),
    addException: vi.fn(),
    moveToLane: vi.fn(),
    openSubprocess: vi.fn(),
    requestInsertOnEdge: vi.fn(),
    focusIssue: vi.fn(),
  } satisfies PanelCommands;
}

const lanes = [{ id: 'legal', name: 'Jurídico', width: LANE_WIDTH }];

interface RenderParams {
  readonly graph: Graph;
  readonly nodeId: string;
  readonly issues?: readonly ProcessIssue[];
}

function renderBlock({ graph, nodeId, issues = [] }: RenderParams) {
  const processGraph = toProcessGraph(graph);
  const node = processGraph.nodes.find(
    (candidate) => candidate.id === nodeId,
  ) as ProcessNode;
  const commands = commandsMock();
  render(
    <BlockProperties
      node={node}
      graph={processGraph}
      lanes={lanes}
      issues={issues}
      commands={commands}
    />,
  );
  return commands;
}

describe('BlockProperties', () => {
  it('converte a Etapa depois de mostrar que nada se perde', async () => {
    const commands = renderBlock({
      graph: { nodes: [block({ id: 'step', type: 'task' })], edges: [] },
      nodeId: 'step',
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Converter em Tarefa humana' }),
    );
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Sem incompatibilidades/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Converter' }));

    expect(commands.convert).toHaveBeenCalledWith({
      nodeId: 'step',
      to: 'human-task',
    });
  });

  it('edita os campos da Tarefa humana, troca a raia e prende exceção', () => {
    const commands = renderBlock({
      graph: {
        nodes: [block({ id: 'person', type: 'human-task' })],
        edges: [],
      },
      nodeId: 'person',
    });

    fireEvent.change(screen.getByLabelText('Instruções'), {
      target: { value: 'Conferir o contrato' },
    });
    fireEvent.change(screen.getByLabelText('Raia'), {
      target: { value: 'legal' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Adicionar evento de exceção' }),
    );

    expect(commands.updateBlock).toHaveBeenCalledWith({
      nodeId: 'person',
      patch: { instructions: 'Conferir o contrato' },
    });
    expect(commands.moveToLane).toHaveBeenCalledWith({
      nodeId: 'person',
      laneId: 'legal',
    });
    expect(commands.addException).toHaveBeenCalledWith('person');
  });

  it('edita condição do ramo e caminho padrão da decisão', () => {
    const commands = renderBlock({
      graph: {
        nodes: [
          block({
            id: 'd',
            type: 'decision',
            data: { branches: decisionBranches },
          }),
        ],
        edges: [],
      },
      nodeId: 'd',
    });

    fireEvent.change(screen.getByLabelText('Condição do ramo Sim'), {
      target: { value: 'valor > 100' },
    });
    fireEvent.change(screen.getByLabelText('Caminho padrão'), {
      target: { value: 'no' },
    });

    expect(commands.updateBranch).toHaveBeenCalledWith({
      nodeId: 'd',
      branchId: 'yes',
      patch: { condition: 'valor > 100' },
    });
    expect(commands.updateBlock).toHaveBeenCalledWith({
      nodeId: 'd',
      patch: { defaultBranchId: 'no' },
    });
  });

  it('mostra a abertura e as chegadas esperadas da sincronização', () => {
    renderBlock({
      graph: {
        nodes: [
          block({
            id: 'split',
            type: 'parallel-split',
            data: { label: 'Dividir', branches: decisionBranches },
          }),
          block({
            id: 'join',
            type: 'parallel-join',
            data: { pairId: 'split' },
          }),
        ],
        edges: [],
      },
      nodeId: 'join',
    });

    expect(
      (screen.getByLabelText('Abertura correspondente') as HTMLSelectElement)
        .value,
    ).toBe('split');
    expect(screen.getByText('Chegadas esperadas de Dividir')).toBeTruthy();
    expect(screen.getByText('Sim')).toBeTruthy();
  });

  it('mostra só o campo do modo escolhido no temporizador', () => {
    renderBlock({
      graph: {
        nodes: [
          block({ id: 't', type: 'timer', data: { timerMode: 'until' } }),
        ],
        edges: [],
      },
      nodeId: 't',
    });

    expect(screen.getByLabelText('Data e horário')).toBeTruthy();
    expect(screen.queryByLabelText('Duração')).toBeNull();
  });

  it('abre o subprocesso e leva ao elemento do problema', () => {
    const issue: ProcessIssue = {
      key: 'x',
      severity: 'warning',
      message: 'Sem objetivo.',
      nodeId: 'sub',
    };
    const commands = renderBlock({
      graph: { nodes: [block({ id: 'sub', type: 'subprocess' })], edges: [] },
      nodeId: 'sub',
      issues: [issue],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Abrir subprocesso' }));
    fireEvent.click(screen.getByRole('button', { name: /Sem objetivo/ }));

    expect(commands.openSubprocess).toHaveBeenCalledWith('sub');
    expect(commands.focusIssue).toHaveBeenCalledWith(issue);
  });
});
