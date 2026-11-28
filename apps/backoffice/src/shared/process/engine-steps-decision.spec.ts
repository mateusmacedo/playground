import { advance } from './engine';
import {
  ACTED_AT,
  act,
  begin,
  branching,
  resolve,
  step,
  tokenAt,
  tokenRefs,
} from './engine-test-kit';
import { parallelPlan, reviewFields, stoppedAt } from './engine-test-plans';
import type { PlanStep } from './plan';

const NOT_ACTIONABLE = {
  ok: false,
  refusal: {
    code: 'not-actionable',
    message: 'Esta etapa não espera uma ação agora.',
  },
};

describe('advance com choose numa decisão', () => {
  const decision = branching({
    id: 'a',
    kind: 'decision',
    branches: { yes: 'done', no: 'other' },
  });

  it('segue só pelo ramo escolhido e registra a escolha', () => {
    const { plan, run, tokenId } = stoppedAt(decision);

    const moved = act({
      plan,
      run,
      action: { kind: 'choose', tokenId, exitIds: ['no'], note: 'Sem verba.' },
      by: 'Ana',
    });

    expect(tokenRefs(moved)).toEqual(['other']);
    expect(moved.takenExits).toEqual(['start:out', 'a:no']);
    expect(moved.log.at(-1)).toEqual({
      at: ACTED_AT,
      kind: 'choice',
      stepRef: 'a',
      label: 'a',
      detail: 'no',
      note: 'Sem verba.',
      by: 'Ana',
    });
  });

  it('conta uma vez a saída repetida na escolha', () => {
    const { plan, run } = stoppedAt(decision);

    const moved = resolve({ plan, run, stepRef: 'a', exitIds: ['yes', 'yes'] });

    expect(tokenRefs(moved)).toEqual(['done']);
  });

  it('recusa escolher mais de um ramo', () => {
    const { plan, run, tokenId } = stoppedAt(decision);

    const result = advance({
      plan,
      run,
      action: { kind: 'choose', tokenId, exitIds: ['yes', 'no'] },
      at: ACTED_AT,
    });

    expect(result).toEqual({
      ok: false,
      refusal: { code: 'exit-count', message: 'Escolha um único caminho.' },
    });
  });

  it('recusa a escolha sem nenhum ramo', () => {
    const { plan, run, tokenId } = stoppedAt(decision);

    const result = advance({
      plan,
      run,
      action: { kind: 'choose', tokenId, exitIds: [] },
      at: ACTED_AT,
    });

    expect(result).toEqual({
      ok: false,
      refusal: { code: 'exit-count', message: 'Escolha um único caminho.' },
    });
  });

  it('recusa a saída que a etapa não tem', () => {
    const { plan, run, tokenId } = stoppedAt(decision);

    const result = advance({
      plan,
      run,
      action: { kind: 'choose', tokenId, exitIds: ['maybe'] },
      at: ACTED_AT,
    });

    expect(result).toEqual({
      ok: false,
      refusal: {
        code: 'invalid-exit',
        message: 'Este caminho não existe nesta etapa.',
      },
    });
  });

  it('recusa escolher caminho na etapa que só se conclui', () => {
    const { plan, run, tokenId } = stoppedAt(step({ id: 'a', to: 'done' }));

    const result = advance({
      plan,
      run,
      action: { kind: 'choose', tokenId, exitIds: ['out'] },
      at: ACTED_AT,
    });

    expect(result).toEqual({
      ok: false,
      refusal: {
        code: 'wrong-action',
        message: 'Esta etapa não tem caminhos para escolher.',
      },
    });
  });

  it('recusa escolher caminho pela ficha em espera numa junção', () => {
    const run = resolve({
      plan: parallelPlan,
      run: begin(parallelPlan),
      stepRef: 'a',
    });
    const tokenId = tokenAt({ run, stepRef: 'join' }).id;

    const result = advance({
      plan: parallelPlan,
      run,
      action: { kind: 'choose', tokenId, exitIds: ['out'] },
      at: ACTED_AT,
    });

    expect(result).toEqual(NOT_ACTIONABLE);
  });

  it('valida os campos obrigatórios da etapa de escolha', () => {
    const subject: PlanStep = { ...decision, fields: reviewFields };
    const { plan, run, tokenId } = stoppedAt(subject);

    const result = advance({
      plan,
      run,
      action: { kind: 'choose', tokenId, exitIds: ['yes'] },
      at: ACTED_AT,
    });

    expect(result).toMatchObject({ refusal: { code: 'missing-fields' } });
  });
});

describe('advance com choose numa decisão inclusiva', () => {
  const inclusive = branching({
    id: 'a',
    kind: 'inclusive-split',
    branches: { first: 'done', second: 'other', third: 'end' },
  });

  it('abre uma ficha por ramo escolhido, na ordem do roteiro', () => {
    const { plan, run } = stoppedAt(inclusive);

    const moved = resolve({
      plan,
      run,
      stepRef: 'a',
      exitIds: ['second', 'first'],
    });

    expect(tokenRefs(moved)).toEqual(['done', 'other']);
    expect(moved.takenExits).toEqual(['start:out', 'a:first', 'a:second']);
    expect(moved.log.at(-1)).toMatchObject({
      kind: 'choice',
      detail: 'first, second',
    });
  });

  it('aceita um único ramo', () => {
    const { plan, run } = stoppedAt(inclusive);

    const moved = resolve({ plan, run, stepRef: 'a', exitIds: ['second'] });

    expect(tokenRefs(moved)).toEqual(['other']);
  });

  it('recusa a escolha sem nenhum ramo', () => {
    const { plan, run, tokenId } = stoppedAt(inclusive);

    const result = advance({
      plan,
      run,
      action: { kind: 'choose', tokenId, exitIds: [] },
      at: ACTED_AT,
    });

    expect(result).toEqual({
      ok: false,
      refusal: { code: 'exit-count', message: 'Escolha ao menos um caminho.' },
    });
  });

  it('recusa a escolha em que um dos ramos não é da etapa', () => {
    const { plan, run, tokenId } = stoppedAt(inclusive);

    const result = advance({
      plan,
      run,
      action: { kind: 'choose', tokenId, exitIds: ['first', 'ghost'] },
      at: ACTED_AT,
    });

    expect(result).toMatchObject({ refusal: { code: 'invalid-exit' } });
  });
});
