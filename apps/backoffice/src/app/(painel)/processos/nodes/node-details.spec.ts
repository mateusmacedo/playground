import { nodeDetail } from './node-details';

describe('nodeDetail', () => {
  it('mostra o campo principal de cada tipo', () => {
    expect(
      nodeDetail({
        type: 'human-task',
        data: { label: 'A', role: 'Jurídico' },
      }),
    ).toBe('Papel: Jurídico');
    expect(
      nodeDetail({
        type: 'wait-event',
        data: { label: 'A', deadline: '48 horas' },
      }),
    ).toBe('Prazo: 48 horas');
    expect(
      nodeDetail({
        type: 'timer',
        data: { label: 'A', timerMode: 'until', until: '2026-12-01T09:00' },
      }),
    ).toBe('Até 2026-12-01 09:00');
    expect(
      nodeDetail({ type: 'end', data: { label: 'Fim', outcome: 'Recusado' } }),
    ).toBe('Recusado');
    expect(
      nodeDetail({ type: 'task', data: { label: 'A', description: 'Texto' } }),
    ).toBe('Texto');
  });

  it('fica vazio quando o campo não foi preenchido', () => {
    expect(nodeDetail({ type: 'automated-task', data: { label: 'A' } })).toBe(
      '',
    );
    expect(nodeDetail({ type: 'timer', data: { label: 'A' } })).toBe('');
  });
});
