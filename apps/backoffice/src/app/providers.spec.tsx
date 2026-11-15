import { fireEvent, render, screen } from '@testing-library/react';

import { useSession } from '@/core/session/session-context';
import { useToast } from '@/shared/ui/toast';

import { AppProviders } from './providers';

function Probe() {
  const { status, user } = useSession();
  const toast = useToast();
  return (
    <>
      <p>
        {status} · {user?.displayName}
      </p>
      <button onClick={() => toast.info('Provedores ligados.')} type="button">
        Avisar
      </button>
    </>
  );
}

describe('AppProviders', () => {
  it('entrega a sessão provisória aos filhos', () => {
    render(
      <AppProviders>
        <Probe />
      </AppProviders>,
    );

    expect(screen.getByText('ready · Usuário')).toBeTruthy();
  });

  it('deixa os filhos mostrarem avisos', async () => {
    render(
      <AppProviders>
        <Probe />
      </AppProviders>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Avisar' }));

    expect(await screen.findByText('Provedores ligados.')).toBeTruthy();
  });
});
