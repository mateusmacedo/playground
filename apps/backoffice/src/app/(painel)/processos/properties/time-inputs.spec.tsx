import { fireEvent, render, screen } from '@testing-library/react';

import { DurationInput, OptionalDuration, ScheduleInput } from './time-inputs';

describe('DurationInput', () => {
  it('só entrega número inteiro válido e avisa enquanto o valor é inválido', () => {
    const onChange = vi.fn();
    render(
      <DurationInput
        label="Prazo"
        value={{ amount: 2, unit: 'hours' }}
        onChange={onChange}
      />,
    );
    const amount = screen.getByLabelText('Prazo');

    fireEvent.change(amount, { target: { value: '0' } });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText('Use um número inteiro de 1 a 999.')).toBeTruthy();

    fireEvent.change(amount, { target: { value: '48' } });
    expect(onChange).toHaveBeenCalledWith({ amount: 48, unit: 'hours' });

    fireEvent.change(screen.getByLabelText('Unidade de prazo'), {
      target: { value: 'days' },
    });
    expect(onChange).toHaveBeenLastCalledWith({ amount: 2, unit: 'days' });
  });

  it('volta ao valor salvo ao sair do campo com texto inválido', () => {
    render(
      <DurationInput
        label="Prazo"
        value={{ amount: 2, unit: 'hours' }}
        onChange={vi.fn()}
      />,
    );
    const amount = screen.getByLabelText('Prazo') as HTMLInputElement;

    fireEvent.change(amount, { target: { value: '' } });
    fireEvent.blur(amount);

    expect(amount.value).toBe('2');
  });
});

describe('OptionalDuration', () => {
  it('liga com uma hora e desliga apagando o valor', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <OptionalDuration
        toggleLabel="Tem prazo"
        label="Prazo"
        value={undefined}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByLabelText('Tem prazo'));
    expect(onChange).toHaveBeenCalledWith({ amount: 1, unit: 'hours' });

    rerender(
      <OptionalDuration
        toggleLabel="Tem prazo"
        label="Prazo"
        value={{ amount: 1, unit: 'hours' }}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByLabelText('Tem prazo'));
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });
});

describe('ScheduleInput', () => {
  it('troca a recorrência mantendo o horário e mostra só o dia que ela usa', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ScheduleInput
        value={{ recurrence: 'daily', time: '08:30' }}
        onChange={onChange}
      />,
    );
    expect(screen.queryByLabelText('Dia da semana')).toBeNull();

    fireEvent.change(screen.getByLabelText('Repetição'), {
      target: { value: 'weekly' },
    });
    expect(onChange).toHaveBeenCalledWith({
      recurrence: 'weekly',
      time: '08:30',
      weekday: 1,
    });

    rerender(
      <ScheduleInput
        value={{ recurrence: 'monthly', time: '08:30', monthDay: 1 }}
        onChange={onChange}
      />,
    );
    const day = screen.getByLabelText('Dia do mês') as HTMLSelectElement;
    expect([...day.options].map((option) => option.value).at(-1)).toBe('last');
    expect([...day.options]).toHaveLength(29);
  });

  it('ignora horário incompleto', () => {
    const onChange = vi.fn();
    render(
      <ScheduleInput
        value={{ recurrence: 'daily', time: '08:30' }}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByLabelText('Horário'), {
      target: { value: '' },
    });

    expect(onChange).not.toHaveBeenCalled();
  });
});
