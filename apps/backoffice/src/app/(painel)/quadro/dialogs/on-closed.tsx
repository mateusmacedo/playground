import { useEffect, useRef } from 'react';

export interface OnClosedProps {
  readonly onClosed: () => void;
}

/**
 * Avisa quando o conteúdo da janela desmonta, o que o `CModal` faz no fim da animação de saída.
 *
 * WHY: ao fechar, o `CModal` devolve o foco ao próprio elemento da janela, que logo depois sai da página; focar outro
 * elemento antes disso não adianta, então o foco só pode ser movido aqui.
 */
export function OnClosed({ onClosed }: Readonly<OnClosedProps>) {
  const callback = useRef(onClosed);
  useEffect(() => {
    callback.current = onClosed;
  });
  useEffect(() => () => callback.current(), []);
  return null;
}
