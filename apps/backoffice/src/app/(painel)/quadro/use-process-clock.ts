import { useEffect, useState } from 'react';

/** De quanto em quanto tempo o instante é lido de novo, em milissegundos: os prazos das etapas valem por minuto. */
export const CLOCK_TICK_MS = 60_000;

/**
 * O instante atual (ISO 8601), lido de novo a cada minuto, para dizer quais etapas passaram do prazo. Só existe com
 * `enabled` e depois de montar no navegador: o servidor não tem o relógio de quem usa, e o quadro sem processo em
 * andamento não precisa dele.
 */
export function useProcessClock(enabled: boolean): string | undefined {
  const [now, setNow] = useState<string>();

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const read = () => setNow(new Date().toISOString());
    read();
    const timer = window.setInterval(read, CLOCK_TICK_MS);
    return () => window.clearInterval(timer);
  }, [enabled]);

  return enabled ? now : undefined;
}
