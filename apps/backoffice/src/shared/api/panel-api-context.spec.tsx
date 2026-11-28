import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';

import { CONFIGURED_PANEL_API, createPanelApi } from './panel-api';
import { PanelApiProvider, usePanelApi } from './panel-api-context';

vi.mock('@/core/config/app-config', () => ({
  appConfig: { apiBaseUrl: 'http://127.0.0.1:4010' },
}));

interface WrapperProps {
  readonly children: ReactNode;
}

describe('usePanelApi', () => {
  it('fora do provider, entrega a API configurada para o painel', () => {
    const { result } = renderHook(() => usePanelApi());

    expect(CONFIGURED_PANEL_API).not.toBeNull();
    expect(result.current).toBe(CONFIGURED_PANEL_API);
  });

  it('dentro do provider, entrega a API passada em value', () => {
    const api = createPanelApi({ baseUrl: 'https://api.exemplo.test' });

    const { result } = renderHook(() => usePanelApi(), {
      wrapper: ({ children }: WrapperProps) => (
        <PanelApiProvider value={api}>{children}</PanelApiProvider>
      ),
    });

    expect(result.current).toBe(api);
  });

  it('com null no provider, a tela fica sem API mesmo com uma configurada', () => {
    const { result } = renderHook(() => usePanelApi(), {
      wrapper: ({ children }: WrapperProps) => (
        <PanelApiProvider value={null}>{children}</PanelApiProvider>
      ),
    });

    expect(result.current).toBeNull();
  });
});
