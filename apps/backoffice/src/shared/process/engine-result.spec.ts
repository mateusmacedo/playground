import {
  ALREADY_DELEGATED,
  accepted,
  CHOICE_EXPECTED,
  DELEGATE_REQUIRED,
  ENDLESS_LOOP,
  INVALID_EXIT,
  INVALID_PLAN,
  NOT_ACTIONABLE,
  NOT_RUNNING,
  NOTE_REQUIRED,
  NOTHING_TO_CHOOSE,
  ONE_EXIT_ONLY,
  refused,
  SOME_EXIT_NEEDED,
  UNKNOWN_EVENT,
  UNKNOWN_STEP,
  UNKNOWN_TOKEN,
} from './engine-result';
import { begin } from './engine-test-kit';
import { linearPlan } from './engine-test-plans';

describe('accepted e refused', () => {
  it('accepted devolve a execução como resultado aceito', () => {
    const run = begin(linearPlan);

    expect(accepted(run)).toEqual({ ok: true, run });
  });

  it('refused devolve a recusa como resultado recusado', () => {
    expect(refused(NOT_RUNNING)).toEqual({ ok: false, refusal: NOT_RUNNING });
  });
});

describe('recusas do motor', () => {
  const refusals = [
    INVALID_PLAN,
    NOT_RUNNING,
    UNKNOWN_TOKEN,
    UNKNOWN_STEP,
    NOT_ACTIONABLE,
    CHOICE_EXPECTED,
    NOTHING_TO_CHOOSE,
    ONE_EXIT_ONLY,
    SOME_EXIT_NEEDED,
    INVALID_EXIT,
    NOTE_REQUIRED,
    UNKNOWN_EVENT,
    ALREADY_DELEGATED,
    DELEGATE_REQUIRED,
    ENDLESS_LOOP,
  ];

  it.each(refusals)('$code traz uma mensagem pronta para a tela', (refusal) => {
    expect(refusal.message).toMatch(/^[A-ZÀ-Ú].+\.$/);
  });

  it('cada mensagem é única, para a pessoa distinguir os motivos', () => {
    const messages = new Set(refusals.map((refusal) => refusal.message));

    expect(messages.size).toBe(refusals.length);
  });
});
