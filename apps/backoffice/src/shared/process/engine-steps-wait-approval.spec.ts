import { advance } from './engine';
import {
  ACTED_AT,
  act,
  approval,
  resolve,
  tokenRefs,
  waitEvent,
} from './engine-test-kit';
import { reviewFields, stoppedAt } from './engine-test-plans';
import type { PlanStep } from './plan';

describe('advance com choose numa espera por evento', () => {
  const deadline = { amount: 2, unit: 'hours' } as const;
  const timed = waitEvent({
    id: 'a',
    received: 'done',
    expired: 'other',
    deadline,
  });

  it('segue pela saída do evento recebido', () => {
    const { plan, run } = stoppedAt(timed);

    const moved = resolve({ plan, run, stepRef: 'a', exitIds: ['received'] });

    expect(tokenRefs(moved)).toEqual(['done']);
    expect(moved.log.at(-1)).toMatchObject({
      kind: 'choice',
      detail: 'Evento recebido',
    });
  });

  it('segue pela saída do prazo expirado quando a espera tem prazo', () => {
    const { plan, run } = stoppedAt(timed);

    const moved = resolve({
      plan,
      run,
      stepRef: 'a',
      exitIds: ['expired'],
      at: '2026-11-26T12:00:00.000Z',
    });

    expect(tokenRefs(moved)).toEqual(['other']);
    expect(moved.log.at(-1)?.detail).toBe('Prazo expirado');
  });

  it('registra "antes do previsto" quando o prazo expira antes da hora', () => {
    const { plan, run } = stoppedAt(timed);

    const moved = resolve({ plan, run, stepRef: 'a', exitIds: ['expired'] });

    expect(moved.log.at(-1)?.detail).toBe('Prazo expirado (antes do previsto)');
  });

  it('não registra "antes do previsto" no evento recebido antes do prazo', () => {
    const { plan, run } = stoppedAt(timed);

    const moved = resolve({ plan, run, stepRef: 'a', exitIds: ['received'] });

    expect(moved.log.at(-1)?.detail).toBe('Evento recebido');
  });

  it('recusa o prazo expirado quando a espera não tem prazo', () => {
    const subject = waitEvent({ id: 'a', received: 'done', expired: 'other' });
    const { plan, run, tokenId } = stoppedAt(subject);

    const result = advance({
      plan,
      run,
      action: { kind: 'choose', tokenId, exitIds: ['expired'] },
      at: ACTED_AT,
    });

    expect(result).toMatchObject({ refusal: { code: 'invalid-exit' } });
  });

  it('recusa escolher as duas saídas', () => {
    const { plan, run, tokenId } = stoppedAt(timed);

    const result = advance({
      plan,
      run,
      action: { kind: 'choose', tokenId, exitIds: ['received', 'expired'] },
      at: ACTED_AT,
    });

    expect(result).toMatchObject({ refusal: { code: 'exit-count' } });
  });
});

describe('advance com choose numa aprovação', () => {
  const review = approval({ id: 'a', approved: 'done', rejected: 'other' });

  it('aprova sem exigir observação e registra como aprovação', () => {
    const { plan, run, tokenId } = stoppedAt(review);

    const moved = act({
      plan,
      run,
      action: { kind: 'choose', tokenId, exitIds: ['approved'] },
      by: 'Gestor',
    });

    expect(tokenRefs(moved)).toEqual(['done']);
    expect(moved.log.at(-1)).toEqual({
      at: ACTED_AT,
      kind: 'approval',
      stepRef: 'a',
      label: 'a',
      detail: 'Aprovado',
      by: 'Gestor',
    });
  });

  it('rejeita com o motivo e segue pela saída de rejeitado', () => {
    const { plan, run } = stoppedAt(review);

    const moved = resolve({
      plan,
      run,
      stepRef: 'a',
      exitIds: ['rejected'],
      note: 'Falta o orçamento.',
    });

    expect(tokenRefs(moved)).toEqual(['other']);
    expect(moved.log.at(-1)).toMatchObject({
      kind: 'approval',
      detail: 'Rejeitado',
      note: 'Falta o orçamento.',
    });
  });

  it.each([undefined, '   '])('recusa rejeitar com o motivo %j', (note) => {
    const { plan, run, tokenId } = stoppedAt(review);

    const result = advance({
      plan,
      run,
      action: { kind: 'choose', tokenId, exitIds: ['rejected'], note },
      at: ACTED_AT,
    });

    expect(result).toEqual({
      ok: false,
      refusal: {
        code: 'note-required',
        message: 'Informe o motivo da rejeição.',
      },
    });
  });

  it('recusa aprovar e rejeitar ao mesmo tempo', () => {
    const { plan, run, tokenId } = stoppedAt(review);

    const result = advance({
      plan,
      run,
      action: {
        kind: 'choose',
        tokenId,
        exitIds: ['approved', 'rejected'],
        note: 'Indeciso.',
      },
      at: ACTED_AT,
    });

    expect(result).toMatchObject({ refusal: { code: 'exit-count' } });
  });

  it('exige os campos obrigatórios antes de aprovar', () => {
    const subject: PlanStep = { ...review, fields: reviewFields };
    const { plan, run, tokenId } = stoppedAt(subject);

    const refusedResult = advance({
      plan,
      run,
      action: { kind: 'choose', tokenId, exitIds: ['approved'] },
      at: ACTED_AT,
    });
    const moved = resolve({
      plan,
      run,
      stepRef: 'a',
      exitIds: ['approved'],
      values: { opinion: 'De acordo', agreed: true },
    });

    expect(refusedResult).toMatchObject({
      refusal: { code: 'missing-fields' },
    });
    expect(moved.log.at(-1)?.values).toEqual([
      { label: 'Parecer', value: 'De acordo' },
      { label: 'De acordo', value: 'Sim' },
    ]);
  });
});
