import { fireEvent, render, screen, within } from '@testing-library/react';

import type { Graph } from '../model/blocks';
import { LANE_WIDTH, type Lane } from '../model/document';
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
    addStepField: vi.fn(),
    updateStepField: vi.fn(),
    removeStepField: vi.fn(),
    updateEdgeLabel: vi.fn(),
    duplicateSelected: vi.fn(),
    deleteSelected: vi.fn(),
    convert: vi.fn(),
    addException: vi.fn(),
    moveToLane: vi.fn(),
    openSubprocess: vi.fn(),
    requestInsertOnEdge: vi.fn(),
    focusIssue: vi.fn(),
    setDefaultBranch: vi.fn(),
  } satisfies PanelCommands;
}

const defaultLanes: readonly Lane[] = [
  { id: 'legal', name: 'Jurídico', width: LANE_WIDTH },
];

interface RenderParams {
  readonly graph: Graph;
  readonly nodeId: string;
  readonly issues?: readonly ProcessIssue[];
  /** Raias do processo; o padrão tem uma, e a lista vazia mostra o painel de um processo sem raias. */
  readonly lanes?: readonly Lane[];
}

function renderBlock(params: RenderParams) {
  const { graph, nodeId, issues = [], lanes = defaultLanes } = params;
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
    expect(commands.setDefaultBranch).toHaveBeenCalledWith({
      nodeId: 'd',
      branchId: 'no',
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

describe('BlockProperties nos campos de relógio e de lista', () => {
  it('troca o temporizador para data e horário apagando a duração', () => {
    const commands = renderBlock({
      graph: {
        nodes: [
          block({
            id: 't',
            type: 'timer',
            data: {
              timerMode: 'duration',
              duration: { amount: 2, unit: 'days' },
            },
          }),
        ],
        edges: [],
      },
      nodeId: 't',
    });

    fireEvent.change(screen.getByLabelText('Tipo de espera'), {
      target: { value: 'until' },
    });

    expect(commands.updateBlock).toHaveBeenCalledWith({
      nodeId: 't',
      patch: expect.objectContaining({
        timerMode: 'until',
        duration: undefined,
      }),
    });
  });

  it('grava o agendamento junto com o gatilho e não oferece texto livre de horário', () => {
    const commands = renderBlock({
      graph: { nodes: [block({ id: 's', type: 'start' })], edges: [] },
      nodeId: 's',
    });

    fireEvent.change(screen.getByLabelText('Gatilho'), {
      target: { value: 'schedule' },
    });

    expect(commands.updateBlock).toHaveBeenCalledWith({
      nodeId: 's',
      patch: {
        trigger: 'schedule',
        schedule: { recurrence: 'daily', time: '09:00' },
        triggerMessage: undefined,
      },
    });
  });

  it('pede o nome do desfecho quando ele é Outro', () => {
    const commands = renderBlock({
      graph: {
        nodes: [block({ id: 'e', type: 'end', data: { outcome: 'other' } })],
        edges: [],
      },
      nodeId: 'e',
    });

    expect(screen.getByText('Dê um nome ao desfecho.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Desfecho'), {
      target: { value: 'expired' },
    });

    expect(commands.updateBlock).toHaveBeenCalledWith({
      nodeId: 'e',
      patch: { outcome: 'expired', outcomeLabel: undefined },
    });
  });

  it('escolhe o canal numa lista fechada', () => {
    const commands = renderBlock({
      graph: { nodes: [block({ id: 'm', type: 'send-message' })], edges: [] },
      nodeId: 'm',
    });
    const channel = screen.getByLabelText('Canal') as HTMLSelectElement;

    expect([...channel.options].map((option) => option.text)).toEqual([
      'Escolha o canal',
      'E-mail',
      'SMS',
      'Aplicativo de mensagens',
      'Notificação no sistema',
    ]);
    fireEvent.change(channel, { target: { value: 'sms' } });
    expect(commands.updateBlock).toHaveBeenCalledWith({
      nodeId: 'm',
      patch: { channel: 'sms' },
    });
  });

  it('mostra o papel da raia sem campo de texto quando há raias', () => {
    renderBlock({
      graph: {
        nodes: [
          block({
            id: 'p',
            type: 'human-task',
            data: { role: 'Jurídico', laneId: 'legal' },
          }),
        ],
        edges: [],
      },
      nodeId: 'p',
    });

    expect(screen.queryByLabelText('Papel responsável')).toBeNull();
    expect(
      screen.getByText(/Papel responsável/).closest('p')?.textContent,
    ).toBe('Papel responsável: Jurídico');
  });

  it('tira a condição do caminho padrão e avisa nome de ramo repetido', () => {
    renderBlock({
      graph: {
        nodes: [
          block({
            id: 'd',
            type: 'decision',
            data: {
              branches: [
                { id: 'a', label: 'Sim' },
                { id: 'b', label: 'sim' },
              ],
              defaultBranchId: 'a',
            },
          }),
        ],
        edges: [],
      },
      nodeId: 'd',
    });

    expect(screen.queryByLabelText('Condição do ramo Sim')).toBeNull();
    expect(screen.getByLabelText('Condição do ramo sim')).toBeTruthy();
    expect(screen.getByText('Já existe um ramo com este nome.')).toBeTruthy();
  });
});

describe('BlockProperties nos campos que dependem do modo', () => {
  it('mostra o agendamento do início agendado', () => {
    renderBlock({
      graph: {
        nodes: [
          block({
            id: 's',
            type: 'start',
            data: {
              trigger: 'schedule',
              schedule: { recurrence: 'daily', time: '07:00' },
            },
          }),
        ],
        edges: [],
      },
      nodeId: 's',
    });

    expect((screen.getByLabelText('Horário') as HTMLInputElement).value).toBe(
      '07:00',
    );
  });

  it('mostra o tempo limite da exceção por tempo esgotado', () => {
    renderBlock({
      graph: {
        nodes: [
          block({
            id: 'x',
            type: 'exception',
            data: {
              exceptionTrigger: 'timeout',
              timeout: { amount: 30, unit: 'minutes' },
            },
          }),
        ],
        edges: [],
      },
      nodeId: 'x',
    });

    expect(
      (screen.getByLabelText('Tempo limite') as HTMLInputElement).value,
    ).toBe('30');
  });

  it('edita papel aprovador, instruções e prazo da Aprovação e prende exceção', () => {
    const commands = renderBlock({
      graph: { nodes: [block({ id: 'ok', type: 'approval' })], edges: [] },
      nodeId: 'ok',
      lanes: [],
    });

    fireEvent.change(screen.getByLabelText('Papel aprovador'), {
      target: { value: 'Diretoria' },
    });
    fireEvent.change(screen.getByLabelText('Instruções'), {
      target: { value: 'Confira o orçamento.' },
    });
    fireEvent.click(screen.getByLabelText('Tem prazo de atendimento'));
    fireEvent.click(
      screen.getByRole('button', { name: 'Adicionar evento de exceção' }),
    );

    expect(commands.updateBlock).toHaveBeenCalledWith({
      nodeId: 'ok',
      patch: { role: 'Diretoria' },
    });
    expect(commands.updateBlock).toHaveBeenCalledWith({
      nodeId: 'ok',
      patch: { instructions: 'Confira o orçamento.' },
    });
    expect(commands.updateBlock).toHaveBeenCalledWith({
      nodeId: 'ok',
      patch: { dueIn: { amount: 1, unit: 'hours' } },
    });
    expect(commands.addException).toHaveBeenCalledWith('ok');
    expect(screen.queryByLabelText('Resultado esperado')).toBeNull();
    expect(screen.queryByRole('button', { name: /Converter em/ })).toBeNull();
  });

  it('mostra o papel aprovador pela raia quando o processo tem raias', () => {
    renderBlock({
      graph: { nodes: [block({ id: 'ok', type: 'approval' })], edges: [] },
      nodeId: 'ok',
    });

    expect(screen.queryByLabelText('Papel aprovador')).toBeNull();
    expect(screen.getByText(/Papel aprovador/).closest('p')?.textContent).toBe(
      'Papel aprovador: escolha a raia da aprovação abaixo',
    );
  });

  it.each(['task', 'human-task', 'approval'])(
    'oferece os campos a preencher no bloco %s',
    (type) => {
      const commands = renderBlock({
        graph: { nodes: [block({ id: 'step', type })], edges: [] },
        nodeId: 'step',
      });

      fireEvent.click(screen.getByRole('button', { name: 'Adicionar campo' }));

      expect(
        screen.getByRole('group', { name: 'Campos a preencher' }),
      ).toBeTruthy();
      expect(commands.addStepField).toHaveBeenCalledWith('step');
    },
  );

  it('não oferece campos a preencher no bloco que ninguém resolve à mão', () => {
    renderBlock({
      graph: {
        nodes: [block({ id: 'bot', type: 'automated-task' })],
        edges: [],
      },
      nodeId: 'bot',
    });

    expect(
      screen.queryByRole('button', { name: 'Adicionar campo' }),
    ).toBeNull();
  });
});
