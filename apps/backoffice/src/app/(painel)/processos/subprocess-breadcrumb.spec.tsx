import { fireEvent, render, screen } from '@testing-library/react';

import { SubprocessBreadcrumb } from './subprocess-breadcrumb';

describe('SubprocessBreadcrumb', () => {
  it('não aparece no processo principal', () => {
    render(<SubprocessBreadcrumb crumbs={[]} onOpenLevel={vi.fn()} />);

    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('volta a qualquer nível e marca o atual', () => {
    const onOpenLevel = vi.fn();
    render(
      <SubprocessBreadcrumb
        crumbs={[
          { nodeId: 'a', name: 'Atendimento' },
          { nodeId: 'b', name: 'Cobrança' },
        ]}
        onOpenLevel={onOpenLevel}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Processo principal' }));
    fireEvent.click(screen.getByRole('button', { name: 'Atendimento' }));

    expect(onOpenLevel.mock.calls).toEqual([[0], [1]]);
    expect(screen.getByText('Cobrança').getAttribute('aria-current')).toBe(
      'page',
    );
  });
});
