import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';

import { CheckField, type CheckFieldProps } from './check-field';

type HarnessProps = Partial<Omit<CheckFieldProps, 'checked' | 'onChange'>>;

function Harness(props: Readonly<HarnessProps>) {
  const [checked, setChecked] = useState(false);
  return (
    <>
      <CheckField
        id="aceite"
        label="Aceito os termos"
        {...props}
        checked={checked}
        onChange={setChecked}
      />
      <p id="ajuda">Sem o aceite, o pedido não segue.</p>
    </>
  );
}

describe('CheckField', () => {
  it('marca e desmarca pela caixa, com o rótulo como nome', () => {
    render(<Harness />);
    const box = screen.getByRole('checkbox', { name: 'Aceito os termos' });

    fireEvent.click(box);
    expect(box).toHaveProperty('checked', true);

    fireEvent.click(screen.getByText('Aceito os termos'));
    expect(box).toHaveProperty('checked', false);
  });

  it('mantém a mesma caixa e o foco nela depois de marcar', () => {
    render(<Harness />);
    const box = screen.getByRole('checkbox', { name: 'Aceito os termos' });
    box.focus();

    fireEvent.click(box);

    expect(screen.getByRole('checkbox', { name: 'Aceito os termos' })).toBe(
      box,
    );
    expect(document.activeElement).toBe(box);
  });

  it('expõe a obrigatoriedade, a explicação e o nome próprio para leitor de tela', () => {
    render(
      <Harness
        required
        describedBy="ajuda"
        accessibleName="Aceite dos termos do pedido"
        className="mt-1"
      />,
    );
    const box = screen.getByRole('checkbox', {
      name: 'Aceite dos termos do pedido',
    });

    expect(box.getAttribute('aria-required')).toBe('true');
    expect(box.getAttribute('aria-describedby')).toBe('ajuda');
    expect(box.parentElement?.className).toBe('form-check mt-1');
  });

  it('não muda quando está desabilitada', () => {
    render(<Harness disabled />);
    const box = screen.getByRole('checkbox', { name: 'Aceito os termos' });

    expect(box).toHaveProperty('disabled', true);
    expect(box.parentElement?.className).toBe('form-check');
  });
});
