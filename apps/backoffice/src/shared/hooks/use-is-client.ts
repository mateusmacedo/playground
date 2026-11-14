import { useSyncExternalStore } from 'react';

const subscribeNothing = () => () => undefined;

/**
 * `false` na renderização do servidor e na hidratação, `true` depois. Serve para o que depende do navegador (tema
 * salvo, `localStorage`) sem divergir do HTML que veio do servidor.
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
}
