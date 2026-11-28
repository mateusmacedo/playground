import {
  APPROVED_HANDLE,
  findOutputPort,
  inputLimit,
  inputPortLabel,
  outputHandles,
  outputPortLabel,
  outputPorts,
  REJECTED_HANDLE,
  TRANSITION_TEXT,
} from './ports';
import { block, decisionBranches } from './test-graph';

describe('outputHandles', () => {
  it('dá a saída única, um ponto por ramo ou nenhum', () => {
    expect(outputHandles(block({ id: 't', type: 'task' }))).toEqual(['out']);
    expect(
      outputHandles(
        block({
          id: 'd',
          type: 'decision',
          data: { branches: decisionBranches },
        }),
      ),
    ).toEqual(['yes', 'no']);
    expect(outputHandles(block({ id: 'd', type: 'decision' }))).toEqual([]);
    expect(outputHandles(block({ id: 'e', type: 'end' }))).toEqual([]);
  });

  it('abre a saída de prazo expirado só quando a espera tem prazo', () => {
    expect(outputHandles(block({ id: 'w', type: 'wait-event' }))).toEqual([
      'received',
    ]);
    expect(
      outputHandles(
        block({
          id: 'w',
          type: 'wait-event',
          data: { deadline: { amount: 48, unit: 'hours' } },
        }),
      ),
    ).toEqual(['received', 'expired']);
  });

  it('dá à Aprovação as duas saídas fixas, com a favorável primeiro', () => {
    const approval = block({ id: 'a', type: 'approval' });

    expect(outputHandles(approval)).toEqual([APPROVED_HANDLE, REJECTED_HANDLE]);
    expect(inputLimit(approval)).toBe('one');
  });
});

describe('outputPorts', () => {
  it('dá o significado de cada saída', () => {
    const split = block({
      id: 'p',
      type: 'parallel-split',
      data: { branches: decisionBranches },
    });
    const exception = block({
      id: 'x',
      type: 'exception',
      data: { exceptionTrigger: 'timeout' },
    });

    expect(outputPorts(split).map((port) => port.meaning)).toEqual([
      'parallel',
      'parallel',
    ]);
    expect(outputPorts(exception)).toEqual([
      { id: 'out', meaning: 'exception', label: 'Tempo esgotado' },
    ]);
  });

  it('acha a saída pelo id', () => {
    const wait = block({ id: 'w', type: 'wait-event' });

    expect(findOutputPort({ node: wait, handle: 'received' })?.label).toBe(
      'Evento recebido',
    );
    expect(findOutputPort({ node: wait, handle: 'expired' })).toBeUndefined();
  });

  it('nomeia os pareceres da Aprovação e o significado de cada um', () => {
    const approval = block({ id: 'a', type: 'approval' });

    expect(outputPorts(approval)).toEqual([
      { id: 'approved', meaning: 'approved', label: 'Aprovado' },
      { id: 'rejected', meaning: 'rejected', label: 'Rejeitado' },
    ]);
    expect(TRANSITION_TEXT.approved).toBe('Aprovação');
    expect(TRANSITION_TEXT.rejected).toBe('Rejeição');
  });
});

describe('nomes acessíveis das portas', () => {
  it('nomeia entrada, saída única, ramo e desfecho', () => {
    const task = block({ id: 't', type: 'task', data: { label: 'Analisar' } });
    const decision = block({
      id: 'd',
      type: 'decision',
      data: { label: 'Aprovado?', branches: decisionBranches },
    });
    const wait = block({
      id: 'w',
      type: 'wait-event',
      data: { label: 'Resposta' },
    });
    const [yes] = outputPorts(decision);
    const [received] = outputPorts(wait);
    const [next] = outputPorts(task);
    if (!yes || !received || !next) {
      throw new Error('portas ausentes');
    }

    expect(inputPortLabel(task)).toBe('Entrada de Analisar');
    expect(outputPortLabel({ node: task, port: next })).toBe(
      'Saída de Analisar',
    );
    expect(outputPortLabel({ node: decision, port: yes })).toBe(
      'Ramo Sim de Aprovado?',
    );
    expect(outputPortLabel({ node: wait, port: received })).toBe(
      'Saída Evento recebido de Resposta',
    );
  });

  it('nomeia a saída da Aprovação pelo parecer', () => {
    const approval = block({
      id: 'a',
      type: 'approval',
      data: { label: 'Aprovar compra' },
    });
    const rejected = findOutputPort({ node: approval, handle: 'rejected' });
    if (!rejected) {
      throw new Error('porta ausente');
    }

    expect(outputPortLabel({ node: approval, port: rejected })).toBe(
      'Saída Rejeitado de Aprovar compra',
    );
  });
});
