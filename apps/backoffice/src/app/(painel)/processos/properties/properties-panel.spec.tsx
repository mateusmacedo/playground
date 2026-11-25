import { fireEvent, render, screen } from '@testing-library/react';
import type { ProcessIssue } from '../model/issues';
import { block, decisionBranches, link } from '../model/test-graph';
import { type ProcessGraph, toProcessGraph } from '../process-graph';
import type { PanelCommands } from './panel-commands';
import { PropertiesPanel } from './properties-panel';

const base = toProcessGraph({
  nodes: [
    block({ id: 'start', type: 'start', data: { label: 'Início' } }),
    block({
      id: 'task',
      type: 'task',
      data: { label: 'Revisar', description: 'Ler o pedido' },
    }),
    block({
      id: 'decision',
      type: 'decision',
      data: {
        label: 'Aprovado?',
        branches: decisionBranches,
      },
    }),
    block({ id: 'note', type: 'annotation', data: { label: 'Lembrete' } }),
  ],
  edges: [
    link({ source: 'start', target: 'task' }),
    link({ source: 'task', target: 'decision' }),
    link({ source: 'decision', target: 'start', sourceHandle: 'yes' }),
  ],
});

interface SelectingParams {
  readonly ids: readonly string[];
  readonly graph?: ProcessGraph;
}

function selecting({
  ids,
  graph = base,
}: Readonly<SelectingParams>): ProcessGraph {
  return {
    nodes: graph.nodes.map((node) => ({
      ...node,
      selected: ids.includes(node.id),
    })),
    edges: graph.edges.map((edge) => ({
      ...edge,
      selected: ids.includes(edge.id),
    })),
  };
}

function commandsMock() {
  return {
    updateBlock: vi.fn(),
    addBranch: vi.fn(),
    renameBranch: vi.fn(),
    removeBranch: vi.fn(),
    updateEdgeLabel: vi.fn(),
    duplicateSelected: vi.fn(),
    deleteSelected: vi.fn(),
    updateBranch: vi.fn(),
    convert: vi.fn(),
    addException: vi.fn(),
    moveToLane: vi.fn(),
    openSubprocess: vi.fn(),
    requestInsertOnEdge: vi.fn(),
    focusIssue: vi.fn(),
  } satisfies PanelCommands;
}

interface RenderPanelParams {
  readonly graph: ProcessGraph;
  readonly issues?: readonly ProcessIssue[];
}

function renderPanel({ graph, issues = [] }: Readonly<RenderPanelParams>) {
  const commands = commandsMock();
  render(
    <PropertiesPanel
      graph={graph}
      lanes={[]}
      issues={issues}
      commands={commands}
    />,
  );
  return commands;
}

/** Valor ao lado do termo na lista de fatos da conexão. */
function fact(term: string): string | null | undefined {
  return screen.getByText(term, { selector: 'dt' }).nextElementSibling
    ?.textContent;
}

describe('PropertiesPanel', () => {
  it('resume o processo e diz quando não há problema', () => {
    renderPanel({ graph: base });

    expect(
      screen.getByRole('region', { name: 'Propriedades' }).textContent,
    ).toContain('4 blocos e 3 conexões.');
    expect(screen.getByText('Nenhum problema encontrado.')).toBeTruthy();
  });

  it('lista os problemas do processo', () => {
    renderPanel({
      graph: { nodes: base.nodes.slice(0, 1), edges: [] },
      issues: [
        {
          key: 'x',
          severity: 'error',
          message: 'Início não tem conexão de saída.',
        },
      ],
    });

    expect(screen.getByText(/1 bloco e 0 conexões/)).toBeTruthy();
    expect(screen.getByText('Início não tem conexão de saída.')).toBeTruthy();
  });

  it('mostra a quantidade e as ações da seleção múltipla', () => {
    const commands = renderPanel({
      graph: selecting({ ids: ['task', 'start-out-task'] }),
    });

    expect(screen.getByText('2 itens selecionados.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Duplicar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));

    expect(commands.duplicateSelected).toHaveBeenCalledTimes(1);
    expect(commands.deleteSelected).toHaveBeenCalledTimes(1);
  });

  it('não oferece duplicar quando só há conexões selecionadas', () => {
    renderPanel({
      graph: selecting({ ids: ['start-out-task', 'task-out-decision'] }),
    });

    expect(screen.queryByRole('button', { name: 'Duplicar' })).toBeNull();
  });

  it('edita título e descrição da Etapa e mostra os problemas dela', () => {
    const commands = renderPanel({
      graph: selecting({ ids: ['task'] }),
      issues: [
        {
          key: 'a',
          severity: 'error',
          message: 'Revisar não tem saída.',
          nodeId: 'task',
        },
        {
          key: 'b',
          severity: 'error',
          message: 'Outro problema.',
          nodeId: 'decision',
        },
      ],
    });

    fireEvent.change(screen.getByLabelText('Título'), {
      target: { value: 'Conferir' },
    });
    fireEvent.change(screen.getByLabelText('Descrição'), {
      target: { value: 'Conferir o pedido' },
    });

    expect(commands.updateBlock).toHaveBeenNthCalledWith(1, {
      nodeId: 'task',
      patch: { label: 'Conferir' },
    });
    expect(commands.updateBlock).toHaveBeenNthCalledWith(2, {
      nodeId: 'task',
      patch: { description: 'Conferir o pedido' },
    });
    expect(screen.getByText('Revisar não tem saída.')).toBeTruthy();
    expect(screen.queryByText('Outro problema.')).toBeNull();
  });

  it('edita o texto da Anotação', () => {
    const commands = renderPanel({ graph: selecting({ ids: ['note'] }) });

    fireEvent.change(screen.getByLabelText('Texto'), {
      target: { value: 'Atenção ao prazo' },
    });

    expect(commands.updateBlock).toHaveBeenCalledWith({
      nodeId: 'note',
      patch: { label: 'Atenção ao prazo' },
    });
    expect(screen.queryByLabelText('Descrição')).toBeNull();
  });

  it('cria, renomeia e remove ramos da Decisão', () => {
    const commands = renderPanel({ graph: selecting({ ids: ['decision'] }) });

    fireEvent.change(screen.getByLabelText('Nome do ramo 2'), {
      target: { value: 'Recusado' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Remover o ramo Sim' }));
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar ramo' }));

    expect(commands.renameBranch).toHaveBeenCalledWith({
      nodeId: 'decision',
      branchId: 'no',
      label: 'Recusado',
    });
    expect(commands.removeBranch).toHaveBeenCalledWith({
      nodeId: 'decision',
      branchId: 'yes',
    });
    expect(commands.addBranch).toHaveBeenCalledWith('decision');
  });

  it('edita o rótulo da conexão comum', () => {
    const commands = renderPanel({
      graph: selecting({ ids: ['start-out-task'] }),
    });

    expect(fact('Origem')).toBe('Início');
    expect(fact('Destino')).toBe('Revisar');
    expect(fact('Transição')).toBe('Sequência');
    fireEvent.change(screen.getByLabelText('Rótulo'), {
      target: { value: 'pedido novo' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));

    expect(commands.updateEdgeLabel).toHaveBeenCalledWith({
      edgeId: 'start-out-task',
      label: 'pedido novo',
    });
    expect(commands.deleteSelected).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Duplicar' })).toBeNull();
  });

  it('mostra que o rótulo da conexão de ramo vem do ramo', () => {
    renderPanel({ graph: selecting({ ids: ['decision-yes-start'] }) });

    expect(screen.getByText(/O rótulo "Sim" é herdado do ramo/)).toBeTruthy();
    expect(fact('Transição')).toBe('Condição');
    expect(screen.queryByLabelText('Rótulo')).toBeNull();
  });

  it('nomeia ponta de conexão cujo bloco não existe mais', () => {
    const orphan: ProcessGraph = {
      nodes: [],
      edges: [{ ...link({ source: 'x', target: 'y' }), selected: true }],
    };
    renderPanel({ graph: orphan });

    expect(fact('Origem')).toBe('bloco removido');
    expect(fact('Destino')).toBe('bloco removido');
  });
});
