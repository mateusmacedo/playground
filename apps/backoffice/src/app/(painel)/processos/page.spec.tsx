import { render, renderHook, screen } from '@testing-library/react';

import { useElementIssues } from './issues-context';
import ProcessesPage, { metadata } from './page';
import { mockReactFlow } from './react-flow-test-setup';

mockReactFlow();

describe('ProcessesPage', () => {
  it('mostra o título e o editor com o processo de exemplo', async () => {
    render(<ProcessesPage />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Editor de processos' }),
    ).toBeTruthy();
    expect(screen.getByText('Beta')).toBeTruthy();
    expect(
      screen.getByText('Em teste: pode mudar, e o processo não é gravado.'),
    ).toBeTruthy();
    expect(await screen.findByText('Primeira etapa')).toBeTruthy();
  });

  it('define o título da aba', () => {
    expect(metadata.title).toBe('Processos');
  });
});

describe('useElementIssues', () => {
  it('exige o IssuesProvider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => renderHook(() => useElementIssues('x'))).toThrow(
      'useElementIssues precisa estar dentro do IssuesProvider.',
    );
  });
});
