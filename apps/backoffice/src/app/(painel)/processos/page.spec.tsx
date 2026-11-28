import { render, renderHook, screen } from '@testing-library/react';

import { apiResponse } from '@/shared/api/api-test-kit';

import { useElementIssues } from './issues-context';
import ProcessesPage, { metadata } from './page';
import { mockReactFlow } from './react-flow-test-setup';

mockReactFlow();

describe('ProcessesPage', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('mostra o título e o editor com o processo de exemplo', async () => {
    render(<ProcessesPage />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Editor de processos' }),
    ).toBeTruthy();
    expect(screen.getByText('Beta')).toBeTruthy();
    expect(
      screen.getByText(
        'Em teste: pode mudar. O rascunho fica salvo neste navegador.',
      ),
    ).toBeTruthy();
    expect(await screen.findByText('Primeira etapa')).toBeTruthy();
  });

  it('diz que o rascunho fica no servidor quando a API do painel está ligada', async () => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://127.0.0.1:4010');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => apiResponse({ body: [] })),
    );
    const { default: RemotePage } = await import('./page');

    render(<RemotePage />);

    expect(
      screen.getByText(
        'Em teste: pode mudar. O rascunho fica salvo no servidor.',
      ),
    ).toBeTruthy();
    expect(await screen.findByText(/Crie um processo novo/)).toBeTruthy();
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
