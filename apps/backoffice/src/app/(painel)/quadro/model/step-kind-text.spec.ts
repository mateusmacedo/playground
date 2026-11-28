import { stepKindText } from './step-kind-text';

describe('stepKindText', () => {
  it('dá o nome do tipo da etapa em português', () => {
    expect(stepKindText('human-task')).toBe('Tarefa humana');
    expect(stepKindText('approval')).toBe('Aprovação');
    expect(stepKindText('wait-event')).toBe('Aguardar evento');
  });
});
