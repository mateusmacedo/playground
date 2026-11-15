import { render, screen } from '@testing-library/react';

import { AppProviders } from '../providers';
import PainelLayout from './layout';

const navigation = vi.hoisted(() => ({ pathname: '/' }));

vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
}));

describe('PainelLayout', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('põe a página dentro do shell: menu lateral, cabeçalho, conteúdo e rodapé', () => {
    render(
      <AppProviders>
        <PainelLayout>
          <p>Página do painel</p>
        </PainelLayout>
      </AppProviders>,
    );

    expect(
      screen.getByRole('navigation', { name: 'Menu lateral' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: 'Mostrar ou esconder o menu lateral',
      }),
    ).toBeTruthy();
    expect(screen.getByRole('contentinfo')).toBeTruthy();
    expect(screen.getByRole('main').textContent).toContain('Página do painel');
  });

  it('oferece o atalho para pular ao conteúdo', () => {
    render(
      <AppProviders>
        <PainelLayout>
          <p>Página do painel</p>
        </PainelLayout>
      </AppProviders>,
    );

    const skip = screen.getByRole('link', { name: 'Pular para o conteúdo' });

    expect(skip.getAttribute('href')).toBe('#conteudo');
    expect(screen.getByRole('main').id).toBe('conteudo');
  });
});
