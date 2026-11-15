import { render, screen } from '@testing-library/react';

import { AppBreadcrumb } from './app-breadcrumb';

const navigation = vi.hoisted(() => ({ pathname: '/' }));

vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
}));

describe('AppBreadcrumb', () => {
  it('na raiz mostra só o início, como página atual e sem link', () => {
    navigation.pathname = '/';

    render(<AppBreadcrumb />);

    const current = screen.getByText('Início').closest('li');
    expect(current?.getAttribute('aria-current')).toBe('page');
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('numa página interna liga o início e marca a página como atual', () => {
    navigation.pathname = '/sem-acesso';

    render(<AppBreadcrumb />);

    expect(
      screen.getByRole('link', { name: 'Início' }).getAttribute('href'),
    ).toBe('/');
    const current = screen.getByText('Sem acesso').closest('li');
    expect(current?.getAttribute('aria-current')).toBe('page');
    expect(screen.queryByRole('link', { name: 'Sem acesso' })).toBeNull();
  });

  it('numa rota sem título mostra só a trilha que tem título', () => {
    navigation.pathname = '/desconhecida';

    render(<AppBreadcrumb />);

    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByText('Início')).toBeTruthy();
  });
});
