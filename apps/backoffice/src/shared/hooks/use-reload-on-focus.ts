import { useEffect, useEffectEvent, useRef } from 'react';

export interface UseReloadOnFocusParams {
  /** Relê do servidor o que a tela mostra. */
  readonly reload: () => void;
  /** Com `false`, a volta do foco não relê: é o caso de haver alteração da tela ainda não gravada. */
  readonly enabled?: boolean;
}

/**
 * Chama `reload` quando a pessoa volta para a aba, depois de ter saído dela (trocou de aba, de janela ou minimizou o
 * navegador). É como a tela alcança o que foi gravado em outro lugar enquanto ela estava fora. Cada volta chama uma
 * vez só, mesmo quando o navegador avisa a visibilidade e o foco juntos.
 */
export function useReloadOnFocus(params: UseReloadOnFocusParams): void {
  /** A pessoa saiu da aba e ainda não voltou. */
  const away = useRef(false);

  const comeBack = useEffectEvent(() => {
    if (!away.current) {
      return;
    }
    away.current = false;
    if (params.enabled ?? true) {
      params.reload();
    }
  });

  useEffect(() => {
    const leave = () => {
      away.current = true;
    };
    const onFocus = () => comeBack();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        leave();
        return;
      }
      comeBack();
    };
    // NOTE: a tela pode abrir numa aba de fundo; a primeira vez que ela aparece já é uma volta.
    if (document.visibilityState === 'hidden') {
      leave();
    }
    window.addEventListener('blur', leave);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('blur', leave);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);
}
