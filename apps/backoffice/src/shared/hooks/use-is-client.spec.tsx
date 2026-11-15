import { renderHook } from '@testing-library/react';
import { renderToString } from 'react-dom/server';

import { useIsClient } from './use-is-client';

function Probe() {
  return <p>{String(useIsClient())}</p>;
}

describe('useIsClient', () => {
  it('é true no navegador, depois da renderização', () => {
    const { result } = renderHook(() => useIsClient());

    expect(result.current).toBe(true);
  });

  it('é false na renderização do servidor', () => {
    expect(renderToString(<Probe />)).toContain('false');
  });
});
