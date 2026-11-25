import type { Graph, GraphNode } from './blocks';
import { block } from './test-graph';
import { findIssues } from './validation';

function keysOf(node: GraphNode): string[] {
  const graph: Graph = { nodes: [node], edges: [] };
  return findIssues(graph)
    .map((issue) => issue.key)
    .filter(
      (key) =>
        !/^(missing-start|no-input|no-output|port-unlinked|branch-unlinked|detached)/.test(
          key,
        ),
    );
}

describe('regras de formato dos campos', () => {
  it('aponta temporizador sem o dado do modo escolhido', () => {
    expect(
      keysOf(
        block({ id: 't', type: 'timer', data: { timerMode: 'duration' } }),
      ),
    ).toContain('missing-duration:t');
    expect(
      keysOf(
        block({
          id: 't',
          type: 'timer',
          data: { timerMode: 'until', until: '2026-02-30T09:00' },
        }),
      ),
    ).toContain('missing-until:t');
  });

  it('aponta duração fora da regra', () => {
    const node = block({
      id: 'w',
      type: 'wait-event',
      data: { eventName: 'Resposta', deadline: { amount: 0, unit: 'hours' } },
    });

    expect(keysOf(node)).toContain('invalid-deadline:w');
  });

  it('aponta exceção por tempo esgotado sem tempo limite', () => {
    expect(
      keysOf(
        block({
          id: 'x',
          type: 'exception',
          data: { exceptionTrigger: 'timeout' },
        }),
      ),
    ).toContain('missing-timeout:x');
  });

  it('aponta início agendado sem agendamento válido e por mensagem sem mensagem', () => {
    expect(
      keysOf(block({ id: 's', type: 'start', data: { trigger: 'schedule' } })),
    ).toContain('missing-schedule:s');
    expect(
      keysOf(
        block({
          id: 's',
          type: 'start',
          data: { trigger: 'message', triggerMessage: ' ' },
        }),
      ),
    ).toContain('missing-trigger-message:s');
  });

  it('aponta desfecho Outro sem nome', () => {
    expect(
      keysOf(block({ id: 'e', type: 'end', data: { outcome: 'other' } })),
    ).toContain('missing-outcome-label:e');
  });

  it('aponta ramo sem nome, nome repetido e caminho padrão com condição', () => {
    const node = block({
      id: 'd',
      type: 'decision',
      data: {
        branches: [
          { id: 'a', label: 'Sim', condition: 'valor > 10' },
          { id: 'b', label: ' sim ' },
          { id: 'c', label: '' },
        ],
        defaultBranchId: 'a',
      },
    });

    expect(keysOf(node)).toEqual(
      expect.arrayContaining([
        'duplicate-branch:d:b',
        'unnamed-branch:d:c',
        'default-with-condition:d:a',
      ]),
    );
  });

  it('aponta mensagem sem canal como aviso', () => {
    const issues = findIssues({
      nodes: [
        block({
          id: 'm',
          type: 'send-message',
          data: { recipient: 'Cliente' },
        }),
      ],
      edges: [],
    });

    expect(issues).toContainEqual(
      expect.objectContaining({
        key: 'incomplete-channel:m',
        severity: 'warning',
      }),
    );
  });
});
