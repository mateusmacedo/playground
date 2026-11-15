import { fireEvent, render, screen } from '@testing-library/react';

import { ShellProvider, useShell } from './shell-context';

function Probe() {
  const {
    sidebarVisible,
    setSidebarVisible,
    sidebarUnfoldable,
    toggleSidebarUnfoldable,
  } = useShell();
  return (
    <>
      <p>menu {sidebarVisible ? 'visível' : 'escondido'}</p>
      <p>largura {sidebarUnfoldable ? 'estreita' : 'cheia'}</p>
      <button onClick={() => setSidebarVisible(false)} type="button">
        Esconder
      </button>
      <button onClick={toggleSidebarUnfoldable} type="button">
        Alternar largura
      </button>
    </>
  );
}

function renderProbe() {
  render(
    <ShellProvider>
      <Probe />
    </ShellProvider>,
  );
}

describe('ShellProvider', () => {
  it('começa com o menu visível e na largura cheia', () => {
    renderProbe();

    expect(screen.getByText('menu visível')).toBeTruthy();
    expect(screen.getByText('largura cheia')).toBeTruthy();
  });

  it('esconde o menu quando pedido', () => {
    renderProbe();

    fireEvent.click(screen.getByRole('button', { name: 'Esconder' }));

    expect(screen.getByText('menu escondido')).toBeTruthy();
  });

  it('alterna a largura do menu a cada pedido', () => {
    renderProbe();
    const toggle = screen.getByRole('button', { name: 'Alternar largura' });

    fireEvent.click(toggle);
    expect(screen.getByText('largura estreita')).toBeTruthy();

    fireEvent.click(toggle);
    expect(screen.getByText('largura cheia')).toBeTruthy();
  });
});

describe('useShell', () => {
  it('falha fora do ShellProvider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => render(<Probe />)).toThrow(
      'useShell precisa estar dentro do ShellProvider.',
    );

    vi.restoreAllMocks();
  });
});
