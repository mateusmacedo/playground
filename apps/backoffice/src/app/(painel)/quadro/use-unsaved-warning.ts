import { useEffect } from 'react';

function warnBeforeLeaving(event: BeforeUnloadEvent): void {
  event.preventDefault();
  // WHY: navegadores mais antigos só mostram o aviso de saída com `returnValue` preenchido; o texto é do navegador.
  event.returnValue = true;
}

/**
 * Enquanto `unsaved` vale, fechar ou recarregar a aba passa pelo aviso de saída do navegador: o que ainda não chegou
 * ao servidor se perderia sem a pessoa saber. O aviso sai assim que não há mais nada por gravar.
 */
export function useUnsavedWarning(unsaved: boolean): void {
  useEffect(() => {
    if (!unsaved) {
      return;
    }
    window.addEventListener('beforeunload', warnBeforeLeaving);
    return () => {
      window.removeEventListener('beforeunload', warnBeforeLeaving);
    };
  }, [unsaved]);
}
