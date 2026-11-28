import { fireEvent, within } from '@testing-library/react';

import { step } from '@/shared/process/engine-test-kit';
import { planAround, reviewFields } from '@/shared/process/engine-test-plans';
import type { StepField } from '@/shared/process/fields';

import {
  activeStep,
  activeStepNames,
  freezeClock,
  processSection,
  releaseClock,
  renderRunning,
} from './process-test-kit';

function click(container: HTMLElement, name: string): void {
  fireEvent.click(within(container).getByRole('button', { name }));
}

function type(container: HTMLElement, label: string, value: string): void {
  fireEvent.change(within(container).getByLabelText(label), {
    target: { value },
  });
}

function refusal(container: HTMLElement): string | null {
  return within(container).getByRole('alert').textContent;
}

function trail(): HTMLElement {
  return within(processSection()).getByRole('group');
}

describe('KanbanBoard: campos da etapa', () => {
  beforeEach(freezeClock);
  afterEach(releaseClock);

  it('mostra junto da etapa a recusa do processo quando falta campo obrigatório', async () => {
    const review = step({
      id: 'Revisar',
      to: 'done',
      data: { fields: reviewFields },
    });
    await renderRunning(planAround(review));
    const item = activeStep('Revisar');

    click(item, 'Concluir etapa');

    expect(refusal(item)).toBe(
      'Preencha os campos obrigatórios: Parecer, De acordo.',
    );
    expect(activeStepNames()).toEqual(['Revisar']);
  });

  it('conclui a etapa com os campos preenchidos e os registra na trilha', async () => {
    const review = step({
      id: 'Revisar',
      to: 'done',
      data: { fields: reviewFields },
    });
    await renderRunning(planAround(review));
    const item = activeStep('Revisar');
    click(item, 'Concluir etapa');

    type(item, 'Parecer', 'Favorável');
    type(item, 'Valor', '120');
    fireEvent.click(within(item).getByRole('checkbox', { name: 'De acordo' }));
    click(item, 'Concluir etapa');

    expect(activeStepNames()).toEqual(['done']);
    expect(within(trail()).getByText('Favorável')).toBeTruthy();
    expect(within(trail()).getByText('120')).toBeTruthy();
    expect(within(trail()).getByText('Sim')).toBeTruthy();
  });

  it('oferece o controle de cada tipo de campo e marca os obrigatórios', async () => {
    const fields: readonly StepField[] = [
      { id: 'notes', label: 'Relato', type: 'long-text', required: false },
      { id: 'when', label: 'Data da visita', type: 'date', required: true },
      {
        id: 'level',
        label: 'Nível',
        type: 'choice',
        required: true,
        options: ['Baixo', 'Alto'],
      },
      { id: 'seen', label: 'Visto', type: 'checkbox', required: false },
    ];
    const visit = step({ id: 'Visitar', to: 'done', data: { fields } });
    await renderRunning(planAround(visit));
    const item = activeStep('Visitar');
    const date = within(item).getByLabelText('Data da visita');
    const level = within(item).getByRole('combobox', { name: 'Nível' });

    expect(within(item).getByLabelText('Relato').tagName).toBe('TEXTAREA');
    expect(date.getAttribute('type')).toBe('date');
    expect(date.getAttribute('aria-required')).toBe('true');
    expect(
      within(level)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Selecione', 'Baixo', 'Alto']);
    expect(within(item).getAllByText('Obrigatório.')).toHaveLength(2);

    type(item, 'Relato', 'Tudo certo');
    type(item, 'Data da visita', '2026-11-30');
    fireEvent.change(level, { target: { value: 'Alto' } });
    const seen = within(item).getByRole('checkbox', { name: 'Visto' });
    fireEvent.click(seen);
    fireEvent.click(seen);
    click(item, 'Concluir etapa');

    expect(within(trail()).getByText('Tudo certo')).toBeTruthy();
    expect(within(trail()).getByText('30/11/2026')).toBeTruthy();
    expect(within(trail()).getByText('Alto')).toBeTruthy();
    expect(within(trail()).getByText('Não')).toBeTruthy();
  });

  it('marca como obrigatória a caixa que precisa ser marcada', async () => {
    const review = step({
      id: 'Revisar',
      to: 'done',
      data: { fields: reviewFields },
    });
    await renderRunning(planAround(review));

    const agreed = within(activeStep('Revisar')).getByRole('checkbox', {
      name: 'De acordo',
    });

    expect(agreed.getAttribute('aria-required')).toBe('true');
    expect(agreed.getAttribute('aria-describedby')).toBeTruthy();
  });

  it('mantém o foco na caixa depois de marcá-la, para quem usa o teclado', async () => {
    const review = step({
      id: 'Revisar',
      to: 'done',
      data: { fields: reviewFields },
    });
    await renderRunning(planAround(review));
    const agreed = within(activeStep('Revisar')).getByRole<HTMLInputElement>(
      'checkbox',
      { name: 'De acordo' },
    );
    agreed.focus();

    fireEvent.click(agreed);

    expect(agreed.checked).toBe(true);
    expect(document.activeElement).toBe(agreed);
  });
});
